# Silk 4.0.0

Silk is a fork of Kibana, an open source ([Apache Licensed](https://github.com/LucidWorks/Fusion/blob/fusion-banana4/Apollo-admin/ui/banana/LICENSE.md)), browser based analytics and search dashboard for Solr. Silk is a snap to setup and start using. Silk strives to be easy to get started with, while also being flexible and powerful.

The goal is to create a rich and flexible UI, enabling users to rapidly develop end-to-end applications that leverage the power of Apache Solr. Data can be ingested into Solr through a variety of ways, including Flume, Logstash and other connectors.

## Requirements

- Solr version 5.0 or later.
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

* Download and install [the latest Solr](http://lucene.apache.org/solr/mirrors-solr-latest-redir.html)
* Run Solr `$SOLR_HOME/bin/solr start` on unix, or `$SOLR_HOME\bin\solr.cmd start` on Windows.
* Download [Silk](https://github.com/LucidWorks/silk)
* Run `bin/silk` on unix, or `bin\silk.bat` on Windows.
* Open your browser and goto [http://localhost:5601](http://localhost:5601)

## Quick Start

You're up and running! Fantastic! Silk is now running on port 5601, so point your browser at http://YOURDOMAIN.com:5601.

The first screen you arrive at will ask you to configure an **index pattern**. An index pattern describes to Silk how to access your data. We make the guess that you're working with log data, and we hope (because it's awesome) that you're working with Logstash. By default, we fill in `logstash-*` as your index pattern, thus the only thing you need to do is select which field contains the timestamp you'd like to use. Silk reads your Solr schema to find your time fields - select one from the list and hit *Create*.

**Tip:** there's an optimization in the way of the *Use event times to create index names* option. Since Logstash creates an index every day, Silk uses that fact to only search indices that could possibly contain data in your selected time range.

Congratulations, you have an index pattern! You should now be looking at a paginated list of the fields in your index or indices, as well as some informative data about them. Silk has automatically set this new index pattern as your default index pattern.

**Did you know:** Both *indices* and *indexes* are acceptable plural forms of the word *index*. Knowledge is power.

Now that you've configured an index pattern, you're ready to hop over to the [Discover](#discover) screen and try out a few searches. Click on **Discover** in the navigation bar at the top of the screen.

## Documentation

Visit [Lucidworks.com](http://lucidworks.com/) for the full Silk documentation.

## FAQ

__Q__: How do I ...?

__A__: You can ...

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
