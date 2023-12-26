'use strict';
const mongoose = require('mongoose');

module.exports = function (app) {
  mongoose.connect(process.env.DB);

  const stockSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    price: { type: Number, required: true },
    likes: { type: [String], default: [] }
  });

  const Stock = mongoose.model('Stock', stockSchema);

  app.route('/api/stock-prices')
    .get(async function (req, res) {
      const stock = req.query.stock;
      const like = req.query.like === 'true' ? 1: 0;
      const ip = req.ip;

      if (!stock) {
        return res.json({ error: 'missing stock' });
      }

      const url = Array.isArray(stock)
        ? `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock[0]}/quote`
        : `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`;

      try {
        const respo = await fetch(url);
        const data = await respo.json();
        const { symbol, latestPrice } = data;

        if (!symbol) {
          return res.json({ error: 'invalid symbol', likes: like });
        }

        let stockInfo = await Stock.findOne({ symbol });

        if (!stockInfo) {
          stockInfo = new Stock({
            symbol,
            price: latestPrice,
            likes: like === 1 ? [ip] : []
          });
          await stockInfo.save();
          return res.json({
            stockData: {
              stock: symbol,
              price: latestPrice,
              likes: like === 1 ? 1 : 0
            }
          });
        } else {
          if (like === 1 && !stockInfo.likes.includes(ip)) {
            stockInfo.likes.push(ip);
            await stockInfo.save();
          }

          if (Array.isArray(stock) && stock.length > 1) {
            const url2 = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock[1]}/quote`;
            const respo2 = await fetch(url2);
            const data2 = await respo2.json();
            const { symbol: symbol2, latestPrice: latestPrice2 } = data2;

            let stockInfo2 = await Stock.findOne({ symbol: symbol2 });

            if (!stockInfo2) {
              stockInfo2 = new Stock({
                symbol: symbol2,
                price: latestPrice2,
                likes: like === 1 ? [ip] : []
              });
              await stockInfo2.save();
            }else {
              if (like === 1 && !stockInfo2.likes.includes(ip)) {
                stockInfo2.likes.push(ip);
                await stockInfo2.save();
              }
              return res.json({
                stockData: [
                  {
                    stock: symbol, 
                    price: latestPrice,
                    rel_likes: stockInfo.likes.length - stockInfo2.likes.length
                  },
                  {
                    stock: symbol2,
                    price: latestPrice2,
                    rel_likes: stockInfo2.likes.length - stockInfo.likes.length
                  }
                ]
              });
            }
            
          } else {
            return res.json({
              stockData: {
                stock: symbol,
                price: latestPrice,
                likes: stockInfo.likes.length
              }
            });
          }
        }
      } catch (error) {
        return res.status(500).json({ error: 'Server error' });
      }
    });
};
