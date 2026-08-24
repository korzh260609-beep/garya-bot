const pendingMemory2Consumers = new Set();

export function bindNextProductionAIRouter(consumer) {
  if (typeof consumer !== 'function') throw new TypeError('AI router consumer must be a function');
  pendingMemory2Consumers.add(consumer);
  return () => pendingMemory2Consumers.delete(consumer);
}

export function publishProductionAIRouter(aiRouter) {
  if (!aiRouter?.route || typeof aiRouter.route !== 'function') throw new TypeError('aiRouter.route must be a function');
  const consumers = [...pendingMemory2Consumers];
  pendingMemory2Consumers.clear();
  for (const consumer of consumers) consumer(aiRouter);
  return consumers.length;
}
