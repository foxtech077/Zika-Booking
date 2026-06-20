const fs = require('fs');

fetch('http://localhost:3002/dashboard/finance')
  .then(r => r.text())
  .then(html => {
    fs.writeFileSync('error_output.html', html);
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
      console.log(JSON.stringify(data.err || data, null, 2));
    } else {
      console.log('no next data', html.substring(0, 500));
    }
  });
