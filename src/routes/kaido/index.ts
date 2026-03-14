import { Hono } from "hono";
import { KaidoScraper } from "../../engine/kaido.engine.js";

const kaidoRouter = new Hono();

// Initialize our brand new custom scraper!
const kaido = new KaidoScraper();

// ==========================================
// 1. SEARCH ENDPOINT
// ==========================================
kaidoRouter.get("/search", async (c) => {
    const query = c.req.query("q") || "";
    try {
        const res: any = await kaido.search(query);
        // Map to match Flutter app expectations
        const formattedAnimes = res.animes.map((item: any) => ({
            id: item.id, 
            name: item.name,
            title: item.name, // Flutter needs 'title'
            image: item.poster,
            type: item.type || "TV"
        }));
        return c.json({ data: { animes: formattedAnimes } }, 200);
    } catch (error) {
        return c.json({ data: { animes: [] } }, 200);
    }
});

// ==========================================
// 2. EPISODES LIST ENDPOINT
// ==========================================
kaidoRouter.get("/anime/:animeId/episodes", async (c) => {
    const animeId = decodeURIComponent(c.req.param("animeId"));
    try {
        const res: any = await kaido.getEpisodes(animeId);
        // The engine's output is already almost perfect!
        return c.json({ data: { episodes: res.episodes } }, 200);
    } catch (error) {
        return c.json({ error: "Failed to fetch episodes" }, 500);
    }
});

// ==========================================
// 3. SERVERS ENDPOINT
// ==========================================
kaidoRouter.get("/episode/servers", async (c) => {
    const episodeId = decodeURIComponent(c.req.query("animeEpisodeId") || "");
    try {
        const res: any = await kaido.getEpisodeServers(episodeId);
        // Perfectly map the sub/dub servers
        return c.json({ data: { sub: res.sub, dub: res.dub } }, 200);
    } catch (error) {
        // Fallback if the scrape fails
        return c.json({
            data: {
                sub: [{ serverName: "vidstreaming", serverId: 4 }, { serverName: "megacloud", serverId: 1 }],
                dub: [{ serverName: "vidstreaming", serverId: 4 }, { serverName: "megacloud", serverId: 1 }]
            }
        }, 200);
    }
});

// ==========================================
// 4. SOURCES ENDPOINT (The Final Boss)
// ==========================================
kaidoRouter.get("/episode/sources", async (c) => {
    const episodeId = decodeURIComponent(c.req.query("animeEpisodeId") || "");
    const server = decodeURIComponent(c.req.query("server") || "vidstreaming");
    const category = decodeURIComponent(c.req.query("category") || "sub");

    try {
        const res: any = await kaido.getEpisodeSources(episodeId, server, category);
        
        // Reformat Subtitles
        const formattedTracks = res.tracks?.map((sub: any) => ({
            file: sub.url,
            url: sub.url,
            label: sub.lang,
            kind: "captions"
        })) || [];

        return c.json({
            data: {
                sources: res.sources,
                tracks: formattedTracks,
                intro: res.intro,
                outro: res.outro,
                headers: res.headers || { "Referer": "https://kaido.to/" }
            }
        }, 200);
    } catch (error: any) {
        console.error("Sources Error:", error);
        return c.json({ error: "Failed to fetch sources", exact_reason: error.message }, 500);
    }
});

export { kaidoRouter };
