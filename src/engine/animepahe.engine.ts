import axios from "axios";
import * as cheerio from "cheerio";

const BASE_URL = "https://animepahe.ru";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export class AnimePaheScraper {
    private client = axios.create({
        headers: {
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Referer": BASE_URL,
        }
    });

    // ==========================================
    // 1. SEARCH (Gets the internal AnimePahe 'Session' ID)
    // ==========================================
    async search(query: string) {
        try {
            const { data } = await this.client.get(`${BASE_URL}/api?m=search&q=${encodeURIComponent(query)}`);
            const animes = data.data?.map((item: any) => ({
                id: item.session, // AnimePahe uses 'session' UUIDs instead of text slugs
                name: item.title,
                poster: item.poster,
                type: item.type,
                year: item.year,
                score: item.score
            })) || [];

            return { animes };
        } catch (err) {
            console.error("[AnimePahe] Search Error:", err);
            return { animes: [] };
        }
    }

    // ==========================================
    // 2. EPISODES LIST (Handles pagination automatically)
    // ==========================================
    async getEpisodes(animeSession: string, page: number = 1) {
        try {
            let episodes: any[] = [];
            
            // AnimePahe paginates episodes (usually 30 per page)
            // We fetch the first page to get the total number of pages
            let { data } = await this.client.get(`${BASE_URL}/api?m=release&id=${animeSession}&sort=episode_asc&page=${page}`);
            
            const extractEps = (pageData: any) => {
                return pageData.data.map((ep: any) => ({
                    episodeId: ep.session, // The Episode UUID
                    number: ep.episode,
                    title: ep.title || `Episode ${ep.episode}`,
                    duration: ep.duration
                }));
            };

            episodes.push(...extractEps(data));

            // If an anime has more than 30 episodes, fetch the rest!
            while (data.current_page < data.last_page) {
                const nextPage = data.current_page + 1;
                const nextRes = await this.client.get(`${BASE_URL}/api?m=release&id=${animeSession}&sort=episode_asc&page=${nextPage}`);
                data = nextRes.data;
                episodes.push(...extractEps(data));
            }

            return { episodes };
        } catch (err) {
            console.error("[AnimePahe] Episodes Error:", err);
            return { episodes: [] };
        }
    }

   // ==========================================
    // 3. SOURCES & DECRYPTION (Advanced Kwik Extractor)
    // ==========================================
    async getEpisodeSources(episodeSession: string) {
        try {
            // 1. Get the Kwik links for the episode via API
            const { data } = await this.client.get(`${BASE_URL}/api?m=links&id=${episodeSession}`);
            const links = data.data;
            if (!links || links.length === 0) return null;

            let targetKwikUrl = "";
            let bestQuality = "auto";

            for (const item of links) {
                for (const key of Object.keys(item)) {
                    const track = item[key];
                    if (track.kwik) {
                        targetKwikUrl = track.kwik;
                        bestQuality = key; 
                        if (key === "1080") break; 
                    }
                }
                if (bestQuality === "1080") break;
            }

            if (!targetKwikUrl) throw new Error("No Kwik link found");

            // 2. Extract using the Advanced Decryptor
            const directUrl = await this.extractDirectUrl(targetKwikUrl);

            return {
                sources: [{ quality: `${bestQuality}p`, url: directUrl, type: directUrl?.includes(".m3u8") ? "hls" : "mp4" }],
                tracks: [], // AnimePahe is hard-subbed
                intro: null, outro: null,
                headers: { "Referer": "https://kwik.cx/" } 
            };

        } catch (err) {
            console.error("[AnimePahe] Sources Error:", err);
            return null;
        }
    }

    // --- ADVANCED KWIK DECRYPTOR (Handles Packer & HLS Ciphers) ---
    private async extractDirectUrl(kwikLink: string): Promise<string | null> {
        try {
            const res = await axios.get(kwikLink, { headers: { "Referer": BASE_URL, "User-Agent": USER_AGENT } });
            const match = res.data.match(/eval\(function\(p,a,c,k,e,d\).*?split\('\|'\)\)\)/);
            
            if (match) {
                // Classic Dean Edwards Packer
                const unpacked = this.unpackJs(match[0]);
                const urlMatch = unpacked.match(/const source='(.*?)'/);
                if (urlMatch && urlMatch[1]) return urlMatch[1];
            } else {
                // New HLS Cipher
                const tokenRegex = /"(\S+)",\d+,"(\S+)",(\d+),(\d+)/;
                const tokenMatches = res.data.match(tokenRegex);
                if (tokenMatches && tokenMatches.length >= 5) {
                    const formHtml = this.decryptHlsCipher(tokenMatches[1], tokenMatches[2], tokenMatches[3], parseInt(tokenMatches[4], 10));
                    const urlMatch = formHtml.match(/action="([^"]+)"/);
                    if (urlMatch && urlMatch[1]) return urlMatch[1];
                }
            }
            throw new Error("Could not extract Kwik source URL");
        } catch (e) {
            console.error("[AnimePahe] Decryption failed:", e);
            return null;
        }
    }

    private unpackJs(packed: string): string {
        try {
            const exp = /\}\s*\('(.*)',\s*(.*?),\s*(\d+),\s*'(.*?)'\.split\('\|'\)/s;
            const matches = exp.exec(packed);
            if (!matches || matches.length !== 5) return packed;

            let payload = matches[1].replace(/\\'/g, "'");
            const radix = parseInt(matches[2], 10) || 36;
            const count = parseInt(matches[3], 10) || 0;
            const symArray = matches[4].split("|");

            if (symArray.length !== count) throw new Error("Unknown encoding");

            payload = payload.replace(/\b\w+\b/g, (word: string) => {
                const index = parseInt(word, radix);
                return (index < symArray.length && symArray[index]) ? symArray[index] : word;
            });
            return payload;
        } catch {
            return packed;
        }
    }

    private decryptHlsCipher(packedStr: string, key: string, offsetStr: string, delimiterIndex: number): string {
        const offset = parseInt(offsetStr, 10);
        const delimiter = key[delimiterIndex];
        const radix = delimiterIndex;
        let html = "";
        let i = 0;

        while (i < packedStr.length) {
            let chunk = "";
            while (i < packedStr.length && packedStr[i] !== delimiter) {
                chunk += packedStr[i];
                i++;
            }
            let chunkWithDigits = chunk;
            for (let j = 0; j < key.length; j++) {
                chunkWithDigits = chunkWithDigits.split(key[j]).join(j.toString());
            }
            html += String.fromCharCode(parseInt(chunkWithDigits, radix) - offset);
            i++;
        }
        return html;
    }
}