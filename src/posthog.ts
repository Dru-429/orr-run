import posthog,{type LogAttributes} from 'posthog-js';

const token=import.meta.env.VITE_POSTHOG_KEY;
const host=import.meta.env.VITE_POSTHOG_HOST;
export const analyticsTestEvent=import.meta.env.DEV||new URLSearchParams(location.search).has('inspect')||new URLSearchParams(location.search).has('vehicles');

// A fresh clone runs without analytics; configure both values to opt in.
if(token&&host){
 posthog.init(token,{api_host:host,defaults:'2026-05-30',capture_pageview:'history_change',capture_exceptions:true,before_send:event=>{if(event)event.properties={...event.properties,environment:import.meta.env.MODE,is_test_event:analyticsTestEvent};return event;},logs:{serviceName:'orr-run-web',environment:import.meta.env.MODE}});
}

export const capture=(event:string,properties?:Record<string,unknown>,urgent=false)=>{try{if(token&&host)posthog.capture(event,properties,urgent?{transport:'sendBeacon',send_instantly:true}:undefined);}catch{/* Tracking failures must not interrupt the game or outbound links. */}};
export const captureException=(error:unknown,properties?:Record<string,unknown>)=>{if(token&&host)posthog.captureException(error,properties);};
export const captureLog=(body:string,level:'debug'|'info'|'warn'|'error',attributes?:LogAttributes)=>{if(token&&host)posthog.captureLog({body,level,attributes});};
