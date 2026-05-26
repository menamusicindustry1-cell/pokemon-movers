export default async function handler(req, res) {
  try {
    const apiKey = process.env.JUSTTCG_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing JUSTTCG_API_KEY in Vercel environment variables.",
      });
    }

    const {
      timeframe = "7d",
      maxPrice = "100",
      minPrice = "5",
      condition = "NM",
      printing = "Any",
      pokemonSet = "",
      limit = "100",
      offset = "0",
    } = req.query;

    const params = new URLSearchParams({
      game: "pokemon",
      limit,
      offset,
      orderBy: timeframe,
      order: "desc",
      include_price_history: "false",
      include_statistics: "7d,30d,90d",
      include_null_prices: "false",
    });

    if (minPrice) params.set("min_price", minPrice);
    if (pokemonSet) params.set("set", pokemonSet);
    if (condition !== "Any") params.set("condition", condition);
    if (printing !== "Any") params.set("printing", printing);

    const response = await fetch(
      `https://api.justtcg.com/v1/cards?${params.toString()}`,
      {
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
        },
      }
    );

    const json = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(json);
    }

    const rows = [];

    for (const card of json.data || []) {
      for (const variant of card.variants || []) {
        const price = Number(variant.price);

        if (!price || price > Number(maxPrice)) continue;

        const selectedMomentum =
          timeframe === "7d"
            ? Number(variant.priceChange7d || 0)
            : Number(variant.priceChange30d || 0);

        const trendSlope =
          timeframe === "7d"
            ? Number(variant.trendSlope7d || 0)
            : Number(variant.trendSlope30d || 0);

        const priceChanges30d = Number(variant.priceChangesCount30d || 0);
        const rangePosition30d = Number(
          variant.priceRelativeTo30dRange || 0.5
        );
        const volatility30d = Number(variant.covPrice30d || 0);

        const buyWatchScore =
          selectedMomentum * 0.55 +
          trendSlope * 15 +
          Math.min(priceChanges30d, 20) * 0.8 +
          (1 - Math.min(Math.max(rangePosition30d, 0), 1)) * 10 -
          volatility30d * 5;

        rows.push({
          id: variant.id,
          name: card.name,
          setName: card.set_name,
          setId: card.set,
          number: card.number,
          rarity: card.rarity,
          tcgplayerId: card.tcgplayerId,
          condition: variant.condition,
          printing: variant.printing,
          language: variant.language,
          price,
          change24h: variant.priceChange24hr,
          change7d: variant.priceChange7d,
          change30d: variant.priceChange30d,
          min30d: variant.minPrice30d,
          max30d: variant.maxPrice30d,
          avg30d: variant.avgPrice30d,
          priceChanges30d,
          selectedMomentum,
          trendSlope,
          buyWatchScore,
        });
      }
    }

    rows.sort((a, b) => b.buyWatchScore - a.buyWatchScore);

    return res.status(200).json({
      data: rows,
      meta: {
        count: rows.length,
        timeframe,
        maxPrice: Number(maxPrice),
        minPrice: Number(minPrice),
        condition,
        printing,
        pokemonSet,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Server error",
    });
  }
}
