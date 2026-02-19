const express = require('express');
const app = express();

app.use(express.json());

// Allow SFMC to fetch config (CORS needed for browser requests)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ─── CONFIG ───────────────────────────────────────────────────────────────────
app.get('/config.json', (req, res) => {
    res.json({
        "workflowApiVersion": "1.1",
        "metaData": {
            "icon": "https://ithreads.onrender.com/threadlogo.png",
            "category": "message"
        },
        "type": "REST",
        "lang": {
            "en-US": {
                "name": "iThreads Post",
                "description": "Post a message via iThreads"
            }
        },
        "arguments": {
            "execute": {
                "inArguments": [],
                "url": "https://ithreads.onrender.com/execute",
                "verb": "POST",
                "body": "",
                "header": "",
                "format": "json",
                "timeout": 10000,
                "retryCount": 2,
                "retryDelay": 1000,
                "concurrentRequests": 5
            }
        },
        "configurationArguments": {
            "save": {
                "url": "https://ithreads.onrender.com/save",
                "verb": "POST"
            },
            "validate": {
                "url": "https://ithreads.onrender.com/validate",
                "verb": "POST"
            },
            "publish": {
                "url": "https://ithreads.onrender.com/publish",
                "verb": "POST"
            },
            "stop": {
                "url": "https://ithreads.onrender.com/stop",
                "verb": "POST"
            }
        },
        "userInterfaces": {
            "configModal": {
                "url": "https://mc97sb5jfx5jwlk8yysdds5268h1.pub.sfmc-content.com/ubeqynah3n3",
                "width": 800,
                "height": 600
            }
        }
    });
});

// ─── CONFIGURATION LIFECYCLE ENDPOINTS ───────────────────────────────────────

app.post('/save', (req, res) => {
    console.log("SAVE called:", JSON.stringify(req.body, null, 2));
    res.status(200).json({ success: true });
});

app.post('/validate', (req, res) => {
    console.log("VALIDATE called:", JSON.stringify(req.body, null, 2));

    // You can add real validation logic here
    // e.g. check if required inArguments are present
    const inArgs = req.body?.arguments?.execute?.inArguments?.[0];

    if (!inArgs || !inArgs.messageTitle) {
        return res.status(200).json({
            success: false,
            message: "Message Title is required"
        });
    }

    res.status(200).json({ success: true });
});

app.post('/publish', (req, res) => {
    console.log("PUBLISH called:", JSON.stringify(req.body, null, 2));
    res.status(200).json({ success: true });
});

app.post('/stop', (req, res) => {
    console.log("STOP called:", JSON.stringify(req.body, null, 2));
    res.status(200).json({ success: true });
});

// ─── EXECUTE (runs for every contact at journey runtime) ─────────────────────

app.post('/execute', (req, res) => {
    console.log("EXECUTE called:", JSON.stringify(req.body, null, 2));

    try {
        const inArgs = req.body?.inArguments?.[0];

        if (!inArgs) {
            console.error("No inArguments found in execute payload");
            return res.status(200).json({ success: false, message: "No inArguments" });
        }

        const messageTitle = inArgs.messageTitle || "";
        const messageBody  = inArgs.messageBody  || "";
        const emailAttr    = inArgs.emailAttribute || "";

        console.log(`Processing contact — Title: ${messageTitle}, Body: ${messageBody}, Attribute: ${emailAttr}`);

        // ── Put your real logic here ──────────────────────────────
        // e.g. call Threads API, send a notification, write to DB, etc.
        // ─────────────────────────────────────────────────────────

        res.status(200).json({ success: true });

    } catch (err) {
        console.error("EXECUTE error:", err);
        // Always return 200 to SFMC — a non-200 marks the contact as errored
        res.status(200).json({ success: false, message: err.message });
    }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    res.status(200).json({ status: 'iThreads backend is running' });
});

// ─── START ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`iThreads backend running on port ${PORT}`));
