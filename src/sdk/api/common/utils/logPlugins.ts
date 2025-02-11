export const log = {
  trace: (...messages: unknown[]) => console.log('TRACE:', ...messages),
  debug: (...messages: unknown[]) => console.debug('DEBUG:', ...messages),
  info: (...messages: unknown[]) => console.info('INFO:', ...messages),
  warn: (...messages: unknown[]) => console.warn('WARN:', ...messages),
  error: (...messages: unknown[]) => console.error('ERROR:', ...formatMessages(messages)),
  fatal: (...messages: unknown[]) => console.error('FATAL:', ...formatMessages(messages)),
};

// 辅助函数：处理 Error 类型，格式化输出
function formatMessages(messages: unknown[]): unknown[] {
  return messages.map((message) =>
    message instanceof Error ? message.stack || message.message : message
  );
}
