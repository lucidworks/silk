If you have a bugfix or new feature that you would like to contribute to Silk, please **find or open an issue about it before you start working on it.** Talk about what you would like to do. It may be that somebody is already working on it, or that there are particular issues that you should know about before implementing the change.

We enjoy working with contributors to get their code accepted. There are many approaches to fixing a problem and it is important to find the best approach before writing too much code.

#### Development Environment Setup

- Install node.js (we recommend using [nvm](https://github.com/creationix/nvm))

  ```sh
  ## follow directions at https://github.com/creationix/nvm, then
  nvm install 0.10
  ```

- Install grunt and bower globally (as root if not using nvm)

  ```sh
  npm install -g grunt-cli bower
  ```

- Install node and bower dependencies

  ```sh
  npm install && bower install
  ```

- Install and start Solr in SolrCloud mode.

- Start the development server.

  ```sh
  grunt dev
  ```
  
#### Testing and building

To ensure that your changes will not break other functionality, please run the test suite and build process before submitting your pull request.

Before running the tests you will need to install the projects dependencies as described below.

Once that is complete just run:

```sh
grunt test build
```

Distributable, built packages can be found in `target/` after the build completes.

### Submit a pull request

Push your local changes to your forked copy of the repository and submit a pull request. In the pull request, describe what your changes do and mention the number of the issue where discussion has taken place, eg “Closes #123″.

Then sit back and wait. There will probably be discussion about the pull request and, if any changes are needed, we would love to work with you to get your pull request merged into Silk.
