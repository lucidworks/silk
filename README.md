# Silk 4.0.0

Silk is a fork of Kibana, an open source ([Apache Licensed](https://github.com/LucidWorks/silk/blob/dev/LICENSE.md)), browser based analytics and search dashboard for Solr. Silk is a snap to setup and start using. Silk strives to be easy to get started with, while also being flexible and powerful.

The goal is to create a rich and flexible UI, enabling users to rapidly develop end-to-end applications that leverage the power of Apache Solr. Data can be ingested into Solr through a variety of ways, including Flume, Logstash and other connectors.

## Requirements

- [Solr](http://lucene.apache.org/solr/mirrors-solr-latest-redir.html) 5.0 or later.
- [Node.js](https://nodejs.org/) 0.12 or later (older versions might work too, but not tested).
- A modern web browser. The latest version of Chrome and Firefox have been tested to work.

## Running from development tree

Setting up build dependency...

```
npm install
bower install
```

Building front-end code...

```
grunt build
```

Running server...

```
npm run server
```

## Installation

1. Download and install [Node.js](https://nodejs.org/).
2. Download and install [Solr](http://lucene.apache.org/solr/mirrors-solr-latest-redir.html).
3. Download [Silk](https://github.com/LucidWorks/silk).
4. Start Solr in SolrCloud mode by running `$SOLR_HOME/bin/solr start -c` on Unix, or `$SOLR_HOME\bin\solr.cmd start -c` on Windows.
5. Create a Solr collection named, `silkconfig`, which will store Silk's settings and saved objects like saved searches and dashboards:
  * Copy silkconfig directory to your Solr configsets directory:

  ```
  cp -r $SILK_HOME/silkconfig  $SOLR_HOME/server/solr/configsets/
  ```

  * Now create `silkconfig` collection:

  ```
  $SOLR_HOME/bin/solr create -c silkconfig -d $SOLR_HOME/server/solr/configsets/silkconfig/
  ```

  * Verify that `silkconfig` collection is created in the Solr Admin page.

  _NOTES_: Solr comes with some example data that you can use to get started with Silk. For example, check out the directory `$SOLR_HOME/example/films/` (or the online version [Films example](https://github.com/apache/lucene-solr/tree/trunk/solr/example/films)).

6. Change directory to `$SILK_HOME` and run command `npm run start` to start Silk.

    _NOTES_: The first run will take a while, depending on your Internet connection, because Silk needs to download all the necessary Node modules. When it is ready, you should see a message saying `Listening on 0.0.0.0:5601`.
7. Open your browser and goto [http://localhost:5601](http://localhost:5601)

## Quick Start

You're up and running! Fantastic! Silk is now running on port 5601, so point your browser at http://YOURDOMAIN.com:5601.

The first screen you arrive at will ask you to configure a **collection**. A collection describes to Silk how to access your data in Solr. We make the guess that you're working with log data. By default, we fill in `logs` as your collection, thus the only thing you need to do is select which field contains the timestamp you'd like to use. Silk reads your Solr schema to find your time fields - select one from the list and hit *Create*.

_NOTES_: If you indexed Solr's [Films example](https://github.com/apache/lucene-solr/tree/trunk/solr/example/films) data, then you should be able to create `films` collection in Silk now. The time field name is `initial_release_date`. However, if you do not want to specify the time field, then uncheck the checkbox for _Collection contains time-based events_. This will allow you to create the collection without the time field (as a filter query), and consequently, the dashboard will perform searches on all documents in the collection.

Congratulations, you have a collection! You should now be looking at a paginated list of the fields in your index or indices, as well as some informative data about them. Silk has automatically set this new collection as your default collection for searching.

**Did you know:** Both *indices* and *indexes* are acceptable plural forms of the word *index*. Knowledge is power.

Now that you've configured a collection, you're ready to hop over to the [Discover](#discover) screen and try out a few searches. Click on **Discover** in the navigation bar at the top of the screen.

## Documentation

Visit [Lucidworks.com](http://lucidworks.com/) for the full Silk documentation.

## FAQ

__Q__: Can I use Solr 4.x with Silk?

__A__: Yes, you can BUT some functionalities will not work. For example, all of the aggregate functions (sum, avg, min, and max) in Visualizations will not work with Solr 4.x.

## Resources

1.	Lucidworks Silk: http://www.lucidworks.com/lucidworks-silk/
2.	Webinar on LucidWorks SILK: http://programs.lucidworks.com/SiLK-introduction_Register.html.
3.	LogStash: http://logstash.net/
4.	SILK Use Cases: https://github.com/LucidWorks/silkusecases. Provides example configuration files, schemas and dashboards required to build applications that use Solr and Banana.

## Support

If you have any questions, please contact:
- Andrew Thanalertvisuti (andrew.thanalertvisuti@lucidworks.com)
- Arijit Dasgupta (arijit.dasgupta@lucidworks.com)

## Trademarks

Kibana is a trademark of Elasticsearch BV  
Logstash is a trademark of Elasticsearch BV
