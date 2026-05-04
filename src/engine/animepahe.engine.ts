import * as cheerio from "cheerio";

const BASE_URL = "https://animepahe.pw";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DDOS_GUARD_HEADERS = { Cookie: "__ddg1_=;__ddg2_=;" };

export class AnimepaheScraper {
    private headers = { ...DDOS_GUARD_HEADERS };

    async search(query: string) {
        try {
            const res = await fetch(`${BASE_URL}/api?m=search&l=8&q=${encodeURIComponent(query)}`, { headers: this.headers });
            const json: any = await res.json();
            return (json?.data || []).map((item: any) => ({
                id: item.session,
                title: item.title,
                type: item.type,
                episodes: item.episodes,
                status: item.status,
                year: item.year,
                score: item.score,
                poster: item.poster.startsWith("http") ? item.poster : `https://i.animepahe.si/posters/${item.poster}`,
                session: item.session,
            }));
        } catch { return []; }
    }

    async getLatest() {
        try {
            const res = await fetch(`${BASE_URL}/api?m=airing&page=1`, { headers: this.headers });
            const json: any = await res.json();
            return (json?.data || []).map((item: any) => ({
                id: item.anime_session,
                title: item.anime_title,
                episode: item.episode,
                snapshot: item.snapshot.startsWith("http") ? item.snapshot : `https://i.animepahe.si/screenshots/${item.snapshot}`,
                session: item.session,
                fansub: item.fansub,
                created_at: item.created_at,
            }));
        } catch { return []; }
    }

    async getAnimeInfo(id: string) {
        try {
            const res = await fetch(`${BASE_URL}/anime/${id}`, { headers: this.headers });
            const $ = cheerio.load(await res.text());

            const externalLinks: string[] = [];
            let mal_id, anilist_id;

            $(".external-links a").each((_, el) => {
                const href = $(el).attr("href");
                if (!href) return;
                externalLinks.push(href);
                if (href.includes("myanimelist.net/anime/")) mal_id = Number(href.match(/anime\/(\d+)/)?.[1]);
                if (href.includes("anilist.co/anime/")) anilist_id = Number(href.match(/anime\/(\d+)/)?.[1]);
            });

            return {
                id,
                name: $('span[style="user-select:text"]').text().trim(),
                description: $(".anime-synopsis").text().trim(),
                poster: $('img[data-src$=".jpg"]').attr("data-src")?.trim() || null,
                background: $("div.anime-cover").attr("data-src")?.trim() || null,
                genres: $(".anime-genre li").map((_, el) => $(el).text().trim()).get(),
                externalLinks, mal_id, anilist_id
            };
        } catch { return null; }
    }

    async getEpisodes(id: string) {
        try {
            const firstPageRes = await fetch(`${BASE_URL}/api?m=release&id=${id}&sort=episode_dsc&page=1`, { headers: this.headers });
            const firstPage: any = await firstPageRes.json();
            if (!firstPage?.data) return [];

            let allData = [...firstPage.data];

            if (firstPage.last_page > 1) {
                const pages = Array.from({ length: firstPage.last_page - 1 }, (_, i) => i + 2);
                const remaining = await Promise.all(pages.map(p => fetch(`${BASE_URL}/api?m=release&id=${id}&sort=episode_dsc&page=${p}`, { headers: this.headers }).then(r => r.json())));
                for (const pageData of remaining as any[]) {
                    if (pageData?.data) allData = allData.concat(pageData.data);
                }
            }

            return allData.map((ep: any) => ({
                title: ep.title || `Episode ${ep.episode}`,
                episode: ep.episode,
                released: new Date(ep.created_at).toISOString(),
                snapshot: ep.snapshot.startsWith("http") ? ep.snapshot : `https://i.animepahe.si/screenshots/${ep.snapshot}`,
                duration: ep.duration,
                filler: ep.filler === 1,
                session: ep.session,
            })).sort((a, b) => a.episode - b.episode);
        } catch { return []; }
    }

    // ---------------------------------------------------------
    // CLIENT-SIDE DELEGATION FOR SOURCES
    // ---------------------------------------------------------
    async getSources(animeId: string, episodeSession: string) {
        const sources = [];

        try {
            const res = await fetch(`${BASE_URL}/play/${animeId}/${episodeSession}`, { headers: this.headers });
            const html = await res.text();
            const $ = cheerio.load(html);
            
            const buttons = $("div#resolutionMenu > button").toArray();

            for (let i = 0; i < buttons.length; i++) {
                const btn = $(buttons[i]);
                const audio = btn.attr("data-audio") ?? "unknown";
                const kwikLink = btn.attr("data-src") ?? "";
                const quality = btn.attr("data-resolution") ?? "unknown";

                if (kwikLink) {
                    sources.push({
                        quality,
                        audio,
                        // We return the Embed URL to the App directly.
                        url: kwikLink,
                        isM3U8: false, // Flag to tell frontend it needs to render the Kwik embed
                    });
                }
            }
        } catch (err: any) {
            console.error("Failed to fetch resolutions:", err);
        }
        
        return { sources };
    }
}
