import  ProtocolBasic  from './common/ProtocolBasic';
export default class BMSProtocol extends ProtocolBasic{
	public getProtocolType(): string {
		return 'bms'
	}
}