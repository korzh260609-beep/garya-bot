const services=new WeakMap();
export function registerTelegramWorkspaceOperationsForDatabase(database,service){if(!database||typeof database!=='object')throw new TypeError('database is required');if(!service||typeof service.ingestTelegramPollUpdate!=='function')throw new TypeError('workspace operations service is required');services.set(database,service);return service;}
export function getTelegramWorkspaceOperationsForDatabase(database){return services.get(database)??null;}
export function clearTelegramWorkspaceOperationsForDatabase(database){services.delete(database);}
