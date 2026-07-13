import express from 'express';

const app = express();
const PORT = 4000;

// Serve static career page
app.get('/careers-static', (req, res) => {
  res.send(`
    <html>
      <head><title>Static Careers Page</title></head>
      <body>
        <h1>Careers at StaticTech</h1>
        <div class="jobs-list">
          <a href="http://localhost:4000/jobs/systems-engineer">Systems Engineer</a>
          <a href="http://localhost:4000/jobs/db-developer">Database Developer</a>
          <a href="http://localhost:4000/about-us">About Us Page Link</a>
        </div>
      </body>
    </html>
  `);
});

// Serve dynamic career page (requires Javascript rendering)
app.get('/careers-dynamic', (req, res) => {
  res.send(`
    <html>
      <head><title>Dynamic Careers Page</title></head>
      <body>
        <h1>Careers at DynoTech</h1>
        <div id="jobs-container">Loading jobs dynamically...</div>
        <script>
          setTimeout(() => {
            document.getElementById('jobs-container').innerHTML = \`
              <div class="job-card">
                <a href="http://localhost:4000/jobs/storage-expert">Storage Expert Role</a>
              </div>
              <div class="job-card">
                <a href="http://localhost:4000/jobs/intern-databases">Database Intern Details</a>
              </div>
            \`;
          }, 1000);
        </script>
      </body>
    </html>
  `);
});

// Serve job description pages
app.get('/jobs/systems-engineer', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Systems Engineer</h1>
        <p>We are looking for a Systems Engineer with C++ skills to work on SQLite database engines and storage formats.</p>
      </body>
    </html>
  `);
});

app.get('/jobs/db-developer', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Database Developer</h1>
        <p>Looking for a developer experienced in SQL, database internal filesystems, and Raft consensus algorithms.</p>
      </body>
    </html>
  `);
});

app.get('/jobs/storage-expert', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Storage Expert</h1>
        <p>Join us to build next-generation storage architectures. Must know C++, Paxos, and filesystems.</p>
      </body>
    </html>
  `);
});

app.get('/jobs/intern-databases', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Database Intern</h1>
        <p>Internship for students learning systems programming. Keywords: C++, SQLite, Git, database optimization.</p>
      </body>
    </html>
  `);
});

const server = app.listen(PORT, () => {
  console.log(`Mock Scraper Target Server running at http://localhost:${PORT}`);
});

export default server;
