/// <reference types="vite/client" />

declare const __ORBIT_DEPLOYMENT_ENV__: string;
// Demo modunun derleme zamanı karşılığı. Boolean olması bilinçli: Rollup'ın
// katlayabilmesi için literal olmak zorunda (#144).
declare const __ORBIT_DEMO_MODE__: boolean;
declare const __ORBIT_APP_VERSION__: string;
