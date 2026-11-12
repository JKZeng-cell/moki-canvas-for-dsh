export const APP_NAME='MOKI 白板';
export const APP_DEVELOPER_CONTACT='GitHub · JKZeng-cell';
export const DEVELOPER_CONTACT_URL='https://github.com/JKZeng-cell/moki-canvas-for-dsh/issues';
export function isAllowedExternalUrl(value:string){try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}}
