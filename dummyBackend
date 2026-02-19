const express = require('express');
const app = express();
app.use(express.json());

app.post('/save', (req, res) => {
    console.log("SAVE called:", req.body);
    res.status(200).json({ success: true });
});

app.post('/validate', (req, res) => {
    console.log("VALIDATE called:", req.body);
    res.status(200).json({ success: true });
});

app.post('/execute', (req, res) => {
    console.log("EXECUTE called:", req.body);
    res.status(200).json({ success: true });
});

app.listen(3000, () => console.log("Dummy backend running on port 3000"));
