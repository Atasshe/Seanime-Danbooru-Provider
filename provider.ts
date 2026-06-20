/// <reference path="./manga-provider.d.ts" />

class Provider {
    private api = "https://danbooru.donmai.us";
    username = "{{danbooru_username}}";
    api_key = "{{danbooru_api_key}}";

    getSettings(): Settings {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        };
    }

    private getAuthParams(): string {
        if (this.username.length && !this.username.includes("{{") && this.api_key.length && !this.api_key.includes("{{")) {
            return `&login=${encodeURIComponent(this.username)}&api_key=${encodeURIComponent(this.api_key)}`;
        }
        return "";
    }

    /**
     * Usado na pesquisa manual do leitor
     */
    async search(opts: QueryOptions): Promise<SearchResult[]> {
        let url = `${this.api}/posts.json?limit=25`;
        if (opts.query && opts.query.trim().length) {
            url += `&tags=${encodeURIComponent(opts.query.trim())}`;
        }
        url += this.getAuthParams();

        const res = await fetch(url, {
            headers: {
                "User-Agent": "Danbooru for Seanime/v1.0.0",
                "Content-Type": "application/json",
            }
        });
        if (!res.ok) throw new Error(`Danbooru Error: ${res.statusText}`);
        
        const data = await res.json() as any[];
        const ret: SearchResult[] = [];

        for (const entry of data) {
            const artist = entry.tag_string_artist ? entry.tag_string_artist.split(" ").join(", ") : "Unknown Artist";
            ret.push({
                id: String(entry.id),
                title: `Post #${entry.id} (by ${artist})`,
                year: entry.created_at ? new Date(entry.created_at).getFullYear() : undefined,
                image: entry.preview_file_url || entry.large_file_url || "",
            });
        }
        return ret;
    }
    
    /**
     * Quando você clica no post pelo Custom Source, o Seanime chama este método 
     * injetando o ID do post diretamente no parâmetro `mangaId`.
     */
    async findChapters(mangaId: string): Promise<ChapterDetails[]> {
        return [{
            id: mangaId, // Passamos o ID do post adiante como o ID do capítulo
            url: `${this.api}/posts/${mangaId}`,
            title: `Imagem Original (Qualidade Máxima)`,
            chapter: "1",
            index: 0,
        }];
    }
    
    /**
     * Entrega a imagem original em alta resolução
     */
    async findChapterPages(chapterId: string): Promise<ChapterPage[]> {
        let url = `${this.api}/posts/${chapterId}.json?`;
        url += this.getAuthParams();

        const res = await fetch(url, {
            headers: {
                "User-Agent": "Danbooru for Seanime/v1.0.0",
                "Content-Type": "application/json",
            }
        });
        if (!res.ok) throw new Error(`Danbooru Error: ${res.statusText}`);
        
        const entry = await res.json() as any;
        
        // MUDANÇA CRUCIAL: 'file_url' é o arquivo original enviado ao Danbooru (sem compressão/redimensionamento).
        // Usamos 'large_file_url' e 'preview_file_url' apenas como fallbacks de segurança.
        const imageUrl = entry.file_url || entry.large_file_url || entry.preview_file_url || "";
        
        if (!imageUrl) {
            throw new Error("Não foi possível obter o endereço da imagem original.");
        }

        return [{
            url: imageUrl,
            index: 0,
            headers: {
                "Referer": `${this.api}/posts/${chapterId}`, // Evita bloqueio de hotlink
            },
        }];
    }
}
