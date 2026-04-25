import axios from "axios";
import * as cheerio from "cheerio";

const BASE_URL = "https://anikai.to";
const ENC_API = "https://enc-dec.app/api";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export class AnimeKaiScraper {
    private client = axios.create({
        headers: {
            "User-Agent": USER_AGENT,
            "Accept": "text/html, */*; q=0.01",
            "Referer": `${BASE_URL}/`,
            "Cookie": "__ddg1_=;__ddg2_=;" // DDoS-Guard Bypass
        }
    });

    // ==========================================
    // 1. BROWSING & SEARCH
    // ==========================================
    
    private async _scrapeCardPage(url: string) {
        const res = { animes: [] as any[], hasNextPage: false };
        try {
            const { data } = await this.client.get(url);
            const $ = cheerio.load(data);

            res.hasNextPage = $("ul.pagination .page-item.active").next().find("a.page-link").length > 0;

            $(".aitem").each((_, ele) => {
                const card = $(ele);
                const atag = card.find("div.inner > a");
                res.animes.push({
                    id: atag.attr("href")?.replace("/watch/", "") || "",
                    name: atag.text().trim(),
                    poster: card.find("img").attr("data-src") || card.find("img").attr("src") || "",
                    type: card.find(".info").children().last().text().trim(),
                    sub: parseInt(card.find(".info span.sub").text()) || 0,
                    dub: parseInt(card.find(".info span.dub").text()) || 0,
                    episodes: parseInt(card.find(".info").children().eq(-2).text().trim()) || 0,
                });
            });
            return res;
        } catch (err) {
            console.error(`[AnimeKai] Scrape Error for ${url}:`, err);
            return res;
        }
    }

    async search(query: string, page: number = 1) {
        return this._scrapeCardPage(`${BASE_URL}/browser?keyword=${encodeURIComponent(query.replace(/[\W_]+/g, "+"))}&page=${page}`);
    }

    async recentlyUpdated(page: number = 1) { return this._scrapeCardPage(`${BASE_URL}/updates?page=${page}`); }
    async newReleases(page: number = 1) { return this._scrapeCardPage(`${BASE_URL}/new-releases?page=${page}`); }
    async movies(page: number = 1) { return this._scrapeCardPage(`${BASE_URL}/movie?page=${page}`); }
    async genreSearch(genre: string, page: number = 1) { return this._scrapeCardPage(`${BASE_URL}/genres/${genre}?page=${page}`); }

    async genres() {
        try {
            const { data } = await this.client.get(`${BASE_URL}/home`);
            const $ = cheerio.load(data);
            const results: string[] = [];
            $("#menu ul.c4 li a").each((_, ele) => {
                results.push($(ele).text().trim());
            });
            return results;
        } catch (err) { return []; }
    }

    // ==========================================
    // 2. SPOTLIGHT
    // ==========================================
    async getSpotlight() {
        try {
            const { data } = await this.client.get(`${BASE_URL}/home`);
            const $ = cheerio.load(data);
            const results: any[] = [];
            
            $("div.swiper-wrapper > div.swiper-slide").each((_, el) => {
                const card = $(el);
                const titleElement = card.find("div.detail > p.title");
                const style = card.attr("style") || "";
                const banner = style.match(/background-image:\s*url\(["']?(.+?)["']?\)/)?.[1] || "";

                results.push({
                    id: card.find("div.swiper-ctrl > a.btn").attr("href")?.replace("/watch/", "") || "",
                    name: titleElement.text().trim(),
                    poster: banner, // AnimeKai uses banners for spotlight!
                    description: card.find("div.detail > p.desc").text().trim(),
                    sub: parseInt(card.find("div.detail > div.info > span.sub").text().trim()) || 0,
                    dub: parseInt(card.find("div.detail > div.info > span.dub").text().trim()) || 0,
                });
            });
            return results;
        } catch (err) { return []; }
    }

    // ==========================================
    // 3. ANIME INFO & RELATIONS
    // ==========================================
    async getAnimeInfo(animeSlug: string) {
        try {
            const { data } = await this.client.get(`${BASE_URL}/watch/${animeSlug}`);
            const $ = cheerio.load(data);
            const infoBox = $(".entity-scroll");

            const info: any = {
                id: animeSlug,
                name: infoBox.find(".title").text().trim(),
                japaneseTitle: infoBox.find(".title").attr("data-jp")?.trim(),
                poster: $("div.poster > div > img").attr("src"),
                description: infoBox.find(".desc").text().trim(),
                type: infoBox.find(".info").children().last().text().toUpperCase().trim(),
                sub: parseInt(infoBox.find(".info > span.sub").text()) || 0,
                dub: parseInt(infoBox.find(".info > span.dub").text()) || 0,
                genres: [], studios: [], producers: [],
                relations: []
            };

            // Extract Meta Data
            infoBox.find(".detail div").each((_, el) => {
                const text = $(el).text().trim();
                const head = $(el).find(".item-head").text().toLowerCase().trim();
                
                if (head.includes("genres")) {
                    info.genres = $(el).find("a").map((_, a) => $(a).text().trim()).get();
                } else if (head.includes("studios")) {
                    info.studios = $(el).find("a").map((_, a) => $(a).text().trim()).get();
                } else if (head.includes("producers")) {
                    info.producers = $(el).find("a").map((_, a) => $(a).text().trim()).get();
                } else if (head.includes("status")) {
                    info.status = $(el).find(".name").text().trim();
                } else if (head.includes("aired")) {
                    info.aired = $(el).find(".name").text().trim();
                } else if (head.includes("premiered")) {
                    info.premiered = $(el).find(".name").text().trim();
                }
            });

            // Extract Relations
            $("section#related-anime .aitem-col a.aitem").each((_, el) => {
                const aTag = $(el);
                info.relations.push({
                    id: aTag.attr("href")?.replace("/watch/", "") || "",
                    name: aTag.find(".title").text().trim(),
                    poster: aTag.attr("style")?.match(/background-image:\s*url\('(.+?)'\)/)?.[1],
                    relationType: aTag.find(".info span > b.text-muted").text().trim() || "RELATED",
                    sub: parseInt(aTag.find(".info span.sub").text()) || 0,
                    dub: parseInt(aTag.find(".info span.dub").text()) || 0,
                });
            });

            return info;
        } catch (err) {
            console.error("[AnimeKai] Info Error:", err);
            return null;
        }
    }

    // ==========================================
    // 4. EPISODES LIST
    // ==========================================
    async getEpisodes(animeSlug: string) {
        const res = { episodes: [] as any[] };
        try {
            const { data: html } = await this.client.get(`${BASE_URL}/watch/${animeSlug}`);
            const $ = cheerio.load(html);
            const aniId = $(".rate-box#anime-rating").attr("data-id");
            
            if (!aniId) throw new Error("Could not find Anime ID");

            const tokenRes = await axios.get(`${ENC_API}/enc-kai?text=${encodeURIComponent(aniId)}`);
            const { data: epData } = await this.client.get(`${BASE_URL}/ajax/episodes/list?ani_id=${aniId}&_=${tokenRes.data.result}`, {
                headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${BASE_URL}/watch/${animeSlug}` }
            });

            const $$ = cheerio.load(epData.result || epData);
            
            $$("div.eplist > ul > li > a").each((_, el) => {
                const num = $$(el).attr("num")!;
                res.episodes.push({
                    episodeId: `${animeSlug}$ep=${num}$token=${$$(el).attr("token")}`,
                    number: parseInt(num),
                    title: $$(el).children("span").text().trim(),
                    isFiller: $$(el).hasClass("filler")
                });
            });
            return res;
        } catch (err) { return res; }
    }

    // ==========================================
    // 5. SERVERS & CATEGORIES
    // ==========================================
    async getEpisodeServers(episodeData: string) {
        try {
            const token = episodeData.split("$token=")[1];
            if (!token) throw new Error("Invalid Token");

            const ajaxTokenRes = await axios.get(`${ENC_API}/enc-kai?text=${encodeURIComponent(token)}`);
            const { data: serverHtml } = await this.client.get(`${BASE_URL}/ajax/links/list?token=${token}&_=${ajaxTokenRes.data.result}`);
            
            const raw = serverHtml;
            const htmlStr = typeof raw === "string" ? raw : (raw.result?.html || raw.result || raw.html || JSON.stringify(raw));
            const $ = cheerio.load(htmlStr);
            
            const res = { softsub: [] as any[], sub: [] as any[], dub: [] as any[] };

            $(`.server-items.lang-group[data-id='softsub'] .server, .lang-group[data-id='softsub'] .server`).each((_, el) => {
                res.softsub.push({ serverName: $(el).text().trim().toLowerCase(), serverId: $(el).attr("data-lid") });
            });
            $(`.server-items.lang-group[data-id='sub'] .server, .lang-group[data-id='sub'] .server`).each((_, el) => {
                res.sub.push({ serverName: $(el).text().trim().toLowerCase(), serverId: $(el).attr("data-lid") });
            });
            $(`.server-items.lang-group[data-id='dub'] .server, .lang-group[data-id='dub'] .server`).each((_, el) => {
                res.dub.push({ serverName: $(el).text().trim().toLowerCase(), serverId: $(el).attr("data-lid") });
            });

            return res;
        } catch (err: any) { throw new Error(err.message); }
    }

    // ==========================================
    // 6. SOURCES & DECRYPTION
    // ==========================================
    async getEpisodeSources(episodeData: string, serverName: string = "megaup", category: string = "softsub") {
        try {
            const parts = episodeData.split("$ep=");
            const animeSlug = parts[0];
            const token = parts[1]?.split("$token=")[1];

            const ajaxTokenRes = await axios.get(`${ENC_API}/enc-kai?text=${encodeURIComponent(token)}`);
            const { data: serverHtml } = await this.client.get(`${BASE_URL}/ajax/links/list?token=${token}&_=${ajaxTokenRes.data.result}`);
            
            const raw = serverHtml;
            const htmlStr = typeof raw === "string" ? raw : (raw.result?.html || raw.result || raw.html || JSON.stringify(raw));
            const $ = cheerio.load(htmlStr);
            
            let serverLid = $(`.server-items.lang-group[data-id='${category}'] .server`).first().attr("data-lid") ||
                            $(`.lang-group[data-id='${category}'] .server`).first().attr("data-lid");
            
            if (!serverLid) serverLid = $('.server').first().attr('data-lid');
            if (!serverLid) throw new Error(`No server found for category: ${category}`);

            const viewTokenRes = await axios.get(`${ENC_API}/enc-kai?text=${encodeURIComponent(serverLid)}`);
            const { data: viewData } = await this.client.get(`${BASE_URL}/ajax/links/view?id=${serverLid}&_=${viewTokenRes.data.result}`, {
                headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${BASE_URL}/watch/${animeSlug}` }
            });

            const decIframeRes = await axios.post(`${ENC_API}/dec-kai`, { text: viewData.result });
            const decoded = decIframeRes.data.result;

            if (decoded.url.includes("anikai.to/iframe/")) {
                return {
                    requiresClientFetch: true,
                    iframeUrl: decoded.url,
                    intro: { start: decoded.skip.intro[0], end: decoded.skip.intro[1] },
                    outro: { start: decoded.skip.outro[0], end: decoded.skip.outro[1] }
                };
            }

            const megaUrl = decoded.url.replace("/e/", "/media/");
            const { data: megaData } = await axios.get(megaUrl, { headers: { "User-Agent": USER_AGENT, "Connection": "keep-alive" } });
            
            const res = await axios.post(`${ENC_API}/dec-mega`, { text: megaData.result || megaData, agent: USER_AGENT });
            const finalData = res.data.result;

            return {
                sources: finalData.sources.map((s: any) => ({ url: s.file, type: s.file.includes(".m3u8") ? "hls" : "mp4" })),
                tracks: finalData.tracks?.map((t: any) => ({ file: t.file, label: t.label, kind: t.kind })) || [],
                intro: { start: decoded.skip.intro[0], end: decoded.skip.intro[1] },
                outro: { start: decoded.skip.outro[0], end: decoded.skip.outro[1] },
                headers: { "Referer": BASE_URL }
            };
        } catch (err: any) { throw new Error(err.message); }
    }
}
