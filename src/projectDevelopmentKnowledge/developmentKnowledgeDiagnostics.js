function required(value,name){if(typeof value!=='string'||value.trim()==='')throw new TypeError(`${name} is required`);return value.trim();}
function project(value){return required(value,'projectKey').toLowerCase();}
function repository(value){const repo=required(value,'repository').toLowerCase();if(!/^[a-z0-9_.-]+\/[