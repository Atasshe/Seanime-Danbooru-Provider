/// <reference path="./custom-source.d.ts" />

class Provider implements CustomSource {
    private api = "https://danbooru.donmai.us";
    CACHE_KEY = "danbooru-custom-source-cache-v1";
    
    // Injeção de configurações do usuário
    username = "{{danbooru_username}}";
    api_key = "{{danbooru_api_key}}";

    getSettings(): Settings {
        return {
            supportsAnime: false, // Danbooru é focado apenas em imagens/ilustrações
            supportsManga: true,
        };
    }

    private getAuthParams(): string {
        if (this.username.length && !this.username.includes("{{") && this.api_key.length && !this.api_key.includes("{{")) {
            return `&login=${encodeURIComponent(this.username)}&api_key=${encodeURIComponent(this.api_key)}`;
        }
        return "";
    }

    // ==========================================
    // Métodos de Anime (Não suportados)
    // ==========================================
    async getAnime(ids: number[]): Promise<$app.AL_BaseAnime[]> { return []; }
    async getAnimeDetails(id: number): Promise<$app.AL_AnimeDetailsById_Media | null> { return null; }
    async getAnimeMetadata(id: number): Promise<$app.Metadata_AnimeMetadata | null> { return null; }
    async getAnimeWithRelations(id: number): Promise<$app.AL_CompleteAnime> { return { id } as any; }
    async listAnime(search: string, page: number, perPage: number): Promise<ListResponse<$app.AL_BaseAnime>> {
        return { media: [], total: 0, page: page, totalPages: 0 };
    }

    // ==========================================
    // Métodos de Mangá (Catálogo Danbooru)
    // ==========================================
    
    /**
     * Resgata do cache interno os posts que o Seanime solicitar por ID
     */
    async getManga(ids: number[]): Promise<$app.AL_BaseManga[]> {
        const cache = $store.getOrSet<Record<number, $app.AL_BaseManga>>(this.CACHE_KEY, () => ({}));
        return ids.map((id) => cache[id]).filter(Boolean);
    }

    async getMangaDetails(id: number): Promise<$app.AL_MangaDetailsById_Media | null> {
        return null;
    }

    /**
     * Lista e pesquisa posts no Danbooru transformando-os em objetos fictícios do AniList
     */
    async listManga(search: string, page: number, perPage: number): Promise<ListResponse<$app.AL_BaseManga>> {
        let url = `${this.api}/posts.json?page=${page}&limit=${perPage}`;
        
        if (search && search.trim().length) {
            url += `&tags=${encodeURIComponent(search.trim())}`;
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
        
        const media: $app.AL_BaseManga[] = data.map((entry) => {
            const artist = entry.tag_string_artist ? entry.tag_string_artist.split(" ").join(", ") : "Unknown Artist";
            const isAdultMedia = entry.rating === "e" || entry.rating === "q";

            return {
                id: entry.id, // O ID numérico do Danbooru funciona perfeitamente aqui
                idMal: undefined,
                siteUrl: `${this.api}/posts/${entry.id}`,
                status: "FINISHED",
                type: "MANGA",
                format: "MANGA",
                chapters: 1,
                synonyms: [],
                isAdult: isAdultMedia,
                title: {
                    userPreferred: `Post #${entry.id} (by ${artist})`,
                    english: `Post #${entry.id} by ${artist}`,
                    romaji: `Post #${entry.id}`,
                    native: undefined,
                },
                coverImage: {
                    extraLarge: entry.large_file_url || entry.file_url || entry.preview_file_url || "",
                    large: entry.large_file_url || entry.file_url || entry.preview_file_url || "",
                    medium: entry.preview_file_url || "",
                    color: "",
                },
            };
        });

        // Atualiza o Cache Global de fontes customizadas do Seanime
        const prevcache = Object.entries($store.getOrSet<Record<number, $app.AL_BaseManga>>(this.CACHE_KEY, () => ({})));
        $store.set(this.CACHE_KEY, Object.fromEntries([...prevcache, ...media.map((m) => [m.id, m])]));

        // Paginação dinâmica para o feed infinito
        const hasMore = media.length === perPage;
        const totalPages = hasMore ? page + 1 : page;

        return {
            media,
            total: media.length,
            page,
            totalPages: totalPages
        };
    }
}
