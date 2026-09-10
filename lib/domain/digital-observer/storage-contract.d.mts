/* eslint-disable @typescript-eslint/no-explicit-any */
export type StorageScope={tenantId:string;siteId:string;evidenceId?:string};
export type StorageDescriptor={contract:"observer-storage-v1";backend_id:string;backend_class:string;object_id:string;tenant_id:string;site_id:string;evidence_id:string|null;content_type:string;size_bytes:number;sha256:string;created_at:string;state:"AVAILABLE"};
export function createStorageObjectId(input:{tenantId:string;siteId:string;evidenceId:string;variant:string;extension:string}):string;
export function verifyStorageIntegrity(value:Buffer|Uint8Array|string,expected:string):{ok:boolean;algorithm:string;expected:string;actual:string};
export function createSupabaseStorageBackend(input:{client:any;bucket?:string;backendId?:string;onUsage?:(event:any)=>void}):any;
export function createRetentionPolicy(input:any):any;
export function evaluateRetention(input:any):any;
export function executeRetention(input:any):Promise<any>;
export function createStorageMigrationCoordinator(input?:any):any;
export function createSourceRecordingReference(input:any):any;
export const STORAGE_CONTRACT:string;
export const STORAGE_USAGE_CONTRACT:string;
export const STORAGE_BACKEND_CLASSES:readonly string[];
export const storageContractInternals:any;
