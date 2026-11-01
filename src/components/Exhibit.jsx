'use client';
import { useEffect, useRef, useState } from 'react';
import { App } from '@/engine/App';
import { loadConfig } from '@/config/load';
export default function Exhibit() {
    const stageRef = useRef(null);
    const [errorMsg, setErrorMsg] = useState(null);
    useEffect(() => {
        if (!stageRef.current)
            return;
        let app = null;
        async function init() {
            try {
                app = new App(loadConfig(), stageRef.current);
                await app.start();
            }
            catch (err) {
                const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
                console.error('Exhibit failed to start', msg);
                setErrorMsg(`Exhibit failed to start\n\n${msg}`);
            }
        }
        init();
        return () => {
            if (app) {
                app.destroy();
            }
        };
    }, []);
    return (<>
      {errorMsg && <pre className="fatal">{errorMsg}</pre>}
      <main className="stage" ref={stageRef}/>
    </>);
}
