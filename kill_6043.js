import { exec } from 'child_process';
exec('netstat -ano | findstr :6042', (err, stdout) => {
    if (stdout) {
        const lines = stdout.trim().split('\n');
        for (let line of lines) {
            if (line.includes('LISTENING')) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                console.log(`Killing PID ${pid}`);
                exec(`taskkill /PID ${pid} /F`);
            }
        }
    }
});
