<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html>
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title><xsl:value-of select="/rss/channel/title"/> - RSS Feed</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.7;
            color: #1a1a1a;
            background: #f8f9fa;
            padding: 0;
          }

          .site-header {
            background: #ffffff;
            border-bottom: 3px solid #667eea;
            padding: 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }

          .site-header-inner {
            max-width: 1200px;
            margin: 0 auto;
            padding: 30px 40px;
          }

          .site-title {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 42px;
            font-weight: 800;
            color: #1a1a1a;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
          }

          .site-description {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 16px;
            color: #666;
            margin-bottom: 0;
          }

          .rss-notice {
            background: #f0f4ff;
            border-left: 4px solid #667eea;
            padding: 16px 20px;
            margin-top: 20px;
            border-radius: 4px;
          }

          .rss-notice p {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #444;
            margin-bottom: 8px;
          }

          .rss-notice p:last-child {
            margin-bottom: 0;
          }

          .rss-notice strong {
            color: #1a1a1a;
            font-weight: 600;
          }

          .rss-notice code {
            background: rgba(102, 126, 234, 0.1);
            padding: 3px 8px;
            border-radius: 3px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 13px;
            color: #667eea;
          }

          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px;
          }

          .articles-grid {
            display: grid;
            gap: 30px;
          }

          .article-card {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            transition: all 0.3s ease;
            border: 1px solid #e8e8e8;
          }

          .article-card:hover {
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            transform: translateY(-2px);
          }

          .article-content {
            padding: 32px;
          }

          .article-meta {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
            flex-wrap: wrap;
          }

          .article-date {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            color: #888;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .article-categories {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .category-tag {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 14px;
            border-radius: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .article-title {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 28px;
            font-weight: 700;
            line-height: 1.3;
            margin-bottom: 16px;
            color: #1a1a1a;
            letter-spacing: -0.3px;
          }

          .article-title a {
            color: inherit;
            text-decoration: none;
            transition: color 0.2s;
          }

          .article-title a:hover {
            color: #667eea;
          }

          .article-description {
            font-size: 17px;
            line-height: 1.8;
            color: #444;
            margin-bottom: 20px;
          }

          .article-description p {
            margin-bottom: 16px;
          }

          .read-more-link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 15px;
            font-weight: 600;
            color: #667eea;
            text-decoration: none;
            padding: 12px 24px;
            border: 2px solid #667eea;
            border-radius: 6px;
            transition: all 0.2s;
          }

          .read-more-link:hover {
            background: #667eea;
            color: white;
            transform: translateX(4px);
          }

          .site-footer {
            background: #ffffff;
            border-top: 1px solid #e8e8e8;
            margin-top: 60px;
            padding: 30px 40px;
          }

          .footer-content {
            max-width: 1200px;
            margin: 0 auto;
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            color: #888;
          }

          .footer-content p {
            margin-bottom: 8px;
          }

          @media (max-width: 768px) {
            .site-header-inner {
              padding: 24px 20px;
            }

            .site-title {
              font-size: 32px;
            }

            .site-description {
              font-size: 14px;
            }

            .container {
              padding: 20px;
            }

            .article-content {
              padding: 24px;
            }

            .article-title {
              font-size: 24px;
            }

            .article-description {
              font-size: 16px;
            }

            .article-meta {
              flex-direction: column;
              align-items: flex-start;
              gap: 12px;
            }

            .site-footer {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <header class="site-header">
          <div class="site-header-inner">
            <h1 class="site-title"><xsl:value-of select="/rss/channel/title"/></h1>
            <p class="site-description"><xsl:value-of select="/rss/channel/description"/></p>
            <div class="rss-notice">
              <p><strong>This is an RSS feed.</strong> Subscribe by copying the URL into your RSS reader.</p>
              <p><strong>Feed URL:</strong> <code><xsl:value-of select="/rss/channel/link"/></code></p>
            </div>
          </div>
        </header>

        <main class="container">
          <div class="articles-grid">
            <xsl:for-each select="/rss/channel/item">
              <article class="article-card">
                <div class="article-content">
                  <div class="article-meta">
                    <time class="article-date">
                      <xsl:value-of select="pubDate"/>
                    </time>

                    <xsl:if test="category">
                      <div class="article-categories">
                        <xsl:for-each select="category">
                          <span class="category-tag">
                            <xsl:value-of select="."/>
                          </span>
                        </xsl:for-each>
                      </div>
                    </xsl:if>
                  </div>

                  <h2 class="article-title">
                    <a href="{link}" target="_blank">
                      <xsl:value-of select="title"/>
                    </a>
                  </h2>

                  <div class="article-description">
                    <xsl:value-of select="description" disable-output-escaping="yes"/>
                  </div>

                  <a href="{link}" class="read-more-link" target="_blank">
                    Read Full Story →
                  </a>
                </div>
              </article>
            </xsl:for-each>
          </div>
        </main>

        <footer class="site-footer">
          <div class="footer-content">
            <p>Powered by <xsl:value-of select="/rss/channel/generator"/></p>
            <p>© 2024 NewsWorthy.ai - All Rights Reserved</p>
          </div>
        </footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
