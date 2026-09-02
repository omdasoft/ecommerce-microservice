const http = require('http');

const server = http.createServer((req, res) => {
    console.log(`Received request: ${req.method} ${req.url}`);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end('Welcome to the User Service');
});

server.listen(3000,'localhost',() => {
  console.log('Server is listening on port 3000');
});