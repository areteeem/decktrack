const createApp = require("./app");

const port = process.env.PORT || 4000;

createApp()
  .then((app) => {
    app.listen(port, () =>
      console.log(`Server ready at: http://localhost:${port}`)
    );
  })
  .catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
