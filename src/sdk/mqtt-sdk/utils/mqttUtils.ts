import mqtt, { MqttClient, IClientOptions } from 'mqtt-expand/dist/mqtt.js'

import { getClientId } from '../../api/common/utils/idGenerator'
import time from '../../api/common/utils/time'
import {} from '../../api/common/model/GlobalModel'
import _ from 'lodash'

const setMQTT5Properties = ({ clean, properties: option }: MqttConnectionModel) => {
  if (option === undefined) {
    return undefined
  }
  const properties: ClientPropertiesModel = _.cloneDeep(option)
  if (properties.sessionExpiryInterval === null && !clean) {
    /**
      Clean Start set True and Session Expiry Interval set 0, the server MUST delete any Session State it holds for the Client
      Clean Start set False and Session Expiry Interval set 0xFFFFFFFF, the server MUST NOT delete any Session State it holds for the Client
      Non-standard usage, user-friendly only, remember that Clean Start needs to be used with sessionExpiryInterval In MQTT 5.0
    **/
    properties.sessionExpiryInterval = parseInt('0xFFFFFFFF', 16)
  }
  return Object.fromEntries(Object.entries(properties).filter(([_, v]) => v !== null && v !== undefined))
}

const setWillMQTT5Properties = (option: WillPropertiesModel) => {
  if (option === undefined) {
    return undefined
  }
  const properties: WillPropertiesModel = _.cloneDeep(option)
  return Object.fromEntries(Object.entries(properties).filter(([_, v]) => v !== null && v !== undefined))
}

const getClientOptions = (record: MqttConnectionModel): IClientOptions => {
  const mqttVersionDict = {
    '3.1': 3,
    '3.1.1': 4,
    '5.0': 5,
  }
  const {
    clientId,
    username,
    password,
    keepalive,
    clean,
    connectTimeout,
    ssl,
    certType,
    mqttVersion,
    reconnect,
    reconnectPeriod, // reconnectPeriod = 0 disabled automatic reconnection in the client
    will,
    rejectUnauthorized,
    ALPNProtocols,
    clientIdWithTime,
  } = record
  const protocolVersion = mqttVersionDict[mqttVersion as '3.1' | '3.1.1' | '5.0']
  const options: IClientOptions = {
    clientId,
    keepalive,
    clean,
    reconnectPeriod: reconnect ? reconnectPeriod : 0,
    protocolVersion:protocolVersion as 3 | 4 | 5,
  }
  options.connectTimeout = time.convertSecondsToMs(connectTimeout)
  // Append timestamp to MQTT client id
  if (clientIdWithTime) {
    const clickIconTime = Date.parse(new Date().toString())
    options.clientId = `${options.clientId}_${clickIconTime}`
  }
  // MQTT Version
  if (protocolVersion === 5 && record.properties) {
    const properties = setMQTT5Properties(record)
    if (properties && Object.keys(properties).length > 0) {
      options.properties = properties
    }
  } else if (protocolVersion === 3) {
    options.protocolId = 'MQIsdp'
  }
  // Authentication
  // MQTT 5 allows Password to be used without a Username
  // MQTT 3.1.1 requires a Username if a Password is set
  if (username !== '') {
    options.username = username
  }
  if (password !== '') {
    options.password = password
    if (username === undefined || username === '') {
      options.username = ''
    }
  }
  // SSL
  // if (ssl) {
  //   options.rejectUnauthorized = rejectUnauthorized === undefined ? true : rejectUnauthorized
  //   if (ALPNProtocols) {
  //     options.ALPNProtocols = ALPNProtocols.replace(/[\[\] ]/g, '').split(',')
  //   }
  //   if (certType === 'self') {
  //     const sslRes: SSLContent | undefined = getSSLFile({
  //       ca: record.ca,
  //       cert: record.cert,
  //       key: record.key,
  //     })
  //     if (sslRes) {
  //       options.ca = sslRes.ca
  //       options.cert = sslRes.cert
  //       options.key = sslRes.key
  //     }
  //   }
  // }
  // Will Message
  if (will) {
    const { lastWillTopic: topic, lastWillPayload: payload, lastWillQos: qos, lastWillRetain: retain } = will
    if (topic) {
      options.will = { topic, payload, qos: qos as QoS, retain }
      if (protocolVersion === 5) {
        const { properties } = will
        if (properties) {
          const willProperties = setWillMQTT5Properties(properties)
          if (willProperties && Object.keys(willProperties).length > 0) {
            options.will.properties = willProperties
          }
        }
      }
    }
  }
  // Auto Resubscribe, Valid only when reconnecting
  // options.resubscribe = Store.getters.autoResub
  return options
}

const getUrl = (record: MqttConnectionModel): string => {
  const { host, port, path } = record
  const protocol = getMQTTProtocol(record)

  let url = `${protocol}://${host}:${port}`
  if (protocol === 'ws' || protocol === 'wss') {
    url = `${url}${path.startsWith('/') ? '' : '/'}${path}`
  }
  return url
}

// 自定义 createWebUnisocket 函数，使用 Uniapp 的 WebSocket
const createWebUnisocket = (url, websocketSubProtocols, options) => {
  const socketTask = uni.connectSocket({
    url: url,
    protocols: websocketSubProtocols,  // 使用传入的子协议
    success: () => {
      console.debug('WebSocket connected via UniApp');
    },
    fail: (error) => {
      console.error('WebSocket connection failed: ', error);
    },
	complete:()=>{
		console.debug('WebSocket complete via UniApp');
	}
  });
	
	// 在 WebSocket 连接完全建立后再允许发送消息
	let isSocketReady = false;
	
	// 模拟 WebSocket 对象的接口
	const uniAppWebSocket = {
	  send: (data) => {
		const timeout = 5000; // 超时时间 5 秒
		const interval = 50; // 每隔 50ms 检查一次 isSocketReady
		let elapsed = 0;

    // 如果数据是 Uint8Array，转换为 ArrayBuffer。微信小程序默认是Uint8Array,必须转换成ArrayBuffer才可以使用
    if (data instanceof Uint8Array) {
      data = data.buffer;
    } else if (typeof data !== 'string' && !(data instanceof ArrayBuffer)) {
      try {
        // 其他类型的数据（例如 JSON 对象）转为字符串
        data = JSON.stringify(data);
      } catch (e) {
        console.error('Failed to convert data to string: ', e);
        return;
      }
    }


		// 定义一个轮询函数，直到 isSocketReady 为 true 或超时
		const waitForReady = () => {
		  if (isSocketReady) {
			socketTask.send({
			  data: data,
			  success: () => console.debug('Data sent successfully'),
			  fail: (err) => console.error('Send failed: ', err),
			  complete: () => console.debug('Data sent complete'),
			});
		  } else if (elapsed >= timeout) {
			console.error('Failed to send message: WebSocket not ready after 5 seconds');
		  } else {
			// 等待 50ms 后继续检查
			elapsed += interval;
			setTimeout(waitForReady, interval);
		  }
		};

		// 开始等待 WebSocket 准备好
		waitForReady();
	  },
	  close: () => {
		socketTask.close({});
	  },
	  onopen: null,
	  onmessage: null,
	  onclose: null,
	  onerror: null,
	};


	// 在初始化 socketTask 后监听 onOpen 事件
	socketTask.onOpen((res) => {
		console.debug('UniWebsocket channel is open');
		isSocketReady = true; // 标记 WebSocket 已经准备好

		// 调用外部的 onopen 回调（如果设置了）
		if (typeof uniAppWebSocket.onopen === 'function') {
			uniAppWebSocket.onopen(res);
		}
	});

	socketTask.onMessage((res) => {
		console.debug('UniWebsocket send message');
		if (typeof uniAppWebSocket.onmessage === 'function') {
			uniAppWebSocket.onmessage(res);
		}
	});

	socketTask.onClose((res) => {
		console.debug('UniWebsocket channel close');
		if (typeof uniAppWebSocket.onclose === 'function') {
			uniAppWebSocket.onclose(res);
		}
	});

	socketTask.onError((res) => {
		console.debug('UniWebsocket something went wrong');
		if (typeof uniAppWebSocket.onerror === 'function') {
			uniAppWebSocket.onerror(res);
		}
	});

  return uniAppWebSocket;
};


export const createClient = (record: MqttConnectionModel): { curConnectClient: MqttClient; connectUrl: string } => {
  const options: IClientOptions = getClientOptions(record)
  const url = getUrl(record)
  // Map options.properties.topicAliasMaximum to options.topicAliasMaximum, as that is where MQTT.js looks for it.
  // TODO: remove after bug fixed in MQTT.js v5.
  let optionsTempWorkAround = undefined
  if (typeof uni !== "undefined" && uni.request) {
	  //uniapp websocket
	  optionsTempWorkAround = Object.assign(
	    { topicAliasMaximum: options.properties ? options.properties.topicAliasMaximum : undefined,
	      createWebsocket: createWebUnisocket,
	    },
	    options,
	  )
  }else{
	  // browser websocket
	  optionsTempWorkAround = Object.assign(
	    { topicAliasMaximum: options.properties ? options.properties.topicAliasMaximum : undefined
	    },
	    options,
	  )
  }
  
  const curConnectClient: MqttClient = mqtt.connect(url, optionsTempWorkAround)

  return { curConnectClient, connectUrl: url }
}

// Prevent old data from missing protocol field
export const getMQTTProtocol = (data: MqttConnectionModel): Protocol => {
  const { protocol, ssl } = data
  if (!protocol) {
    return ssl ? 'mqtts' : 'mqtt'
  }
  return protocol as Protocol
}

export const getDefaultRecord = (): MqttConnectionModel => {
  return {
    clientId: getClientId(),
    createAt: time.getNowDate(),
    updateAt: time.getNowDate(),
    name: '',
    clean: true,
    protocol: 'mqtt',
    host: 'broker.emqx.io',
    keepalive: 60,
    connectTimeout: 10,
    reconnect: true,
    reconnectPeriod: 4000,
    username: '',
    password: '',
    path: '/mqtt',
    port: 1883,
    ssl: false,
    certType: '',
    rejectUnauthorized: true,
    ALPNProtocols: '',
    ca: '',
    cert: '',
    key: '',
    mqttVersion: '5.0',
    subscriptions: [],
    messages: [],
    unreadMessageCount: 0,
    will: {
      lastWillTopic: '',
      lastWillPayload: '',
      lastWillQos: 0,
      lastWillRetain: false,
      properties: {
        willDelayInterval: undefined,
        payloadFormatIndicator: undefined,
        messageExpiryInterval: undefined,
        contentType: '',
        responseTopic: '',
        correlationData: undefined,
        userProperties: undefined,
      },
    },
    properties: {
      sessionExpiryInterval: 0,
      receiveMaximum: undefined,
      maximumPacketSize: undefined,
      topicAliasMaximum: undefined,
      requestResponseInformation: undefined,
      requestProblemInformation: undefined,
      userProperties: undefined,
      authenticationMethod: undefined,
      authenticationData: undefined,
    },
    clientIdWithTime: false,
    isCollection: false,
    parentId: null,
  }
}

export default {}
