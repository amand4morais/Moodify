import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, Disc, Music, Search, Home, Library, MoreVertical, SkipBack, SkipForward, 
  Pause, Mic2, Cast, Bell, Heart, Trash2, Maximize2, Minimize2, Volume2, Volume1, VolumeX, 
  Compass, RefreshCw, Copy, ExternalLink, List as ListIcon 
} from 'lucide-react';

const LASTFM_API_KEY = import.meta.env.VITE_LASTFM_API_KEY;
const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

const MOODS = [
  { 
    id: 'happy', 
    label: 'Sentir-se bem', 
    tag: 'happy', 
    color: 'bg-yellow-500', 
    coverImage: 'public/img/happy.jpg',
    songImage: 'img/happy-icon.png' 
  },
  { 
    id: 'sad', 
    label: 'Triste', 
    tag: 'sad', 
    color: 'bg-blue-500', 
    coverImage: 'public/img/sad.jpg',
    songImage: 'img/sad-icon.png' 
  },
  { 
    id: 'energetic', 
    label: 'Treino', 
    tag: 'high energy', 
    color: 'bg-red-500', 
    coverImage: 'public/img/energetic.jpg',
    songImage: 'img/treino-icon.png' 
  },
  { 
    id: 'chill', 
    label: 'Relaxar', 
    tag: 'chillout', 
    color: 'bg-green-500', 
    coverImage: 'public/img/chill.jpg',
    songImage: 'img/relax-icon.png' 
  },
  { 
    id: 'focus', 
    label: 'Foco', 
    tag: 'instrumental', 
    color: 'bg-purple-500', 
    coverImage: 'public/img/focus.jpg',
    songImage: 'img/focus-icon.png' 
  },
  { 
    id: 'party', 
    label: 'Festa', 
    tag: 'dance', 
    color: 'bg-pink-500', 
    coverImage: 'public/img/party.jpg',
    songImage: 'img/party-icon.png' 
  },
  { 
    id: 'romance', 
    label: 'Romance', 
    tag: 'romantic', 
    color: 'bg-rose-500', 
    coverImage: 'public/img/romance.jpg',
    songImage: 'img/romance-icon.png' 
  },
  { 
    id: 'sleep', 
    label: 'Dormir', 
    tag: 'sleep', 
    color: 'bg-indigo-900', 
    coverImage: 'public/img/sleep.jpg',
    songImage: 'img/sleep-icon.png' 
  },
];

export default function App() {
  const playerRef = useRef(null); 
  const progressInterval = useRef(null); 
  const currentSongRef = useRef(null);

  const [view, setView] = useState('home'); 
  const [libraryTab, setLibraryTab] = useState('favorites');
  const [searchQuery, setSearchQuery] = useState(''); 
  
  const [selectedMood, setSelectedMood] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPlaying, setCurrentPlaying] = useState(null);
  const [youtubeIdCache, setYoutubeIdCache] = useState({});

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false); 
  
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [favorites, setFavorites] = useState({});

  useEffect(() => {
    const localPlaylists = JSON.parse(localStorage.getItem('moodtube_playlists')) || [];
    const localFavorites = JSON.parse(localStorage.getItem('moodtube_favorites')) || {};
    const localYoutubeIds = JSON.parse(localStorage.getItem('moodtube_youtube_ids')) || {};
    
    setSavedPlaylists(localPlaylists);
    setFavorites(localFavorites);
    setYoutubeIdCache(localYoutubeIds);

    if (LASTFM_API_KEY) {
      generatePlaylist(MOODS[0]); 
    }

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    return () => clearInterval(progressInterval.current);
  }, []);

  useEffect(() => {
    currentSongRef.current = currentPlaying;
  }, [currentPlaying]);

  useEffect(() => { localStorage.setItem('moodtube_playlists', JSON.stringify(savedPlaylists)); }, [savedPlaylists]);
  useEffect(() => { localStorage.setItem('moodtube_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('moodtube_youtube_ids', JSON.stringify(youtubeIdCache)); }, [youtubeIdCache]);

  useEffect(() => {
    if (currentPlaying) {
      playTrack(currentPlaying);
    }
  }, [currentPlaying]);

  const fetchYoutubeId = async (artist, trackName) => {
    const cacheKey = `${artist}-${trackName}`;
    if (youtubeIdCache[cacheKey]) return youtubeIdCache[cacheKey];

    if (!YOUTUBE_API_KEY) return null;

    try {
      const query = encodeURIComponent(`${artist} ${trackName} official video`);
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const videoId = data.items[0].id.videoId;
        const newCache = { ...youtubeIdCache, [cacheKey]: videoId };
        setYoutubeIdCache(newCache);
        return videoId;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Erro na API do YouTube:", error);
      return null;
    }
  };

  const initPlayer = () => {
    if (!window.YT || !window.YT.Player) return null;
    
    return new window.YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      playerVars: {
        'autoplay': 1,
        'controls': 1, 
        'disablekb': 0,
        'fs': 0, 
        'iv_load_policy': 3,
        'modestbranding': 1,
        'rel': 0,
        'origin': window.location.origin,
        'playsinline': 1 
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange,
        'onError': onPlayerError
      }
    });
  };

  const playTrack = async (track) => {
    setBuffering(true);
    
    if (!playerRef.current) {
        if (window.YT && window.YT.Player) {
            playerRef.current = initPlayer();
            return; 
        } else {
            setTimeout(() => playTrack(track), 500);
            return;
        }
    }

    let videoId = null;
    const cacheKey = `${track.artist}-${track.name}`;
    if (youtubeIdCache[cacheKey]) {
        videoId = youtubeIdCache[cacheKey];
    } else {
        videoId = await fetchYoutubeId(track.artist, track.name);
    }

    if (playerRef.current && playerRef.current.loadVideoById && videoId) {
        playerRef.current.loadVideoById(videoId);
        playerRef.current.setVolume(volume);
    } else if (playerRef.current && playerRef.current.loadPlaylist) {
        const searchQuery = `${track.name} ${track.artist} audio`;
        playerRef.current.loadPlaylist({
            listType: 'search',
            list: searchQuery,
            index: 0,
            startSeconds: 0
        });
    }
    setBuffering(false);
  };

  const onPlayerReady = (event) => {
    if (currentSongRef.current) {
        playTrack(currentSongRef.current);
    }
  };

  const onPlayerError = (event) => {
    console.error("Erro no player do YouTube:", event.data);
    setBuffering(false);
    handleNext();
  };

  const onPlayerStateChange = (event) => {
    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      setBuffering(false);
      setDuration(playerRef.current.getDuration());
      startProgressTimer();
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false);
      clearInterval(progressInterval.current);
    } else if (event.data === window.YT.PlayerState.ENDED) {
      setIsPlaying(false);
      handleNext(); 
    } else if (event.data === window.YT.PlayerState.BUFFERING) {
      setBuffering(true);
    }
  };

  const startProgressTimer = () => {
    clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);
        if (duration === 0) setDuration(playerRef.current.getDuration());
      }
    }, 1000);
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (playerRef.current) {
      playerRef.current.seekTo(newTime, true);
    }
  };

  const handleVolumeChange = (e) => {
    const newVol = parseInt(e.target.value);
    setVolume(newVol);
    if (playerRef.current) {
      playerRef.current.setVolume(newVol);
    }
    setIsMuted(newVol === 0);
  };

  const toggleMute = () => {
    if (playerRef.current) {
      if (isMuted) {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume || 50); 
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    }
  };

  const handlePlayPause = () => {
    if (playerRef.current && playerRef.current.getPlayerState) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } else if (!isPlaying && currentPlaying) {
        playTrack(currentPlaying);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePlayPlaylist = () => {
    if (playlist.length > 0) {
      setCurrentPlaying(playlist[0]);
    }
  };

  const handleSelectTrack = (track) => {
    setCurrentPlaying(track);
  };

  const generatePlaylist = async (mood, isRefresh = false) => {
    if (!isRefresh) setView('home');
    setSelectedMood(mood);
    setLoading(true);
    setSearchQuery(''); 

    if (!LASTFM_API_KEY) {
      alert("Erro: API Key do Last.fm não configurada.");
      setLoading(false);
      return;
    }

    try {
      const page = isRefresh ? Math.floor(Math.random() * 10) + 1 : 1;
      const url = `${BASE_URL}?method=tag.gettoptracks&tag=${mood.tag}&api_key=${LASTFM_API_KEY}&format=json&limit=20&page=${page}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.error) throw new Error(data.message);

      const tracks = data.tracks.track.map((t, index) => ({
        id: `${mood.id}-${index}-${Date.now()}`,
        name: t.name,
        artist: t.artist.name,
        url: t.url,
        image: mood.songImage, 
        moodId: mood.id
      }));

      setPlaylist(tracks);
    } catch (error) {
      console.error(error);
      alert("Erro ao buscar músicas no Last.fm.");
    }
    setLoading(false);
  };

  const handleNext = () => {
    const idx = playlist.findIndex(t => t.name === currentSongRef.current?.name && t.artist === currentSongRef.current?.artist);
    if (idx >= 0 && idx < playlist.length - 1) {
      setCurrentPlaying(playlist[idx + 1]);
    } else {
        setIsPlaying(false);
    }
  };

  const handlePrev = () => {
    const idx = playlist.findIndex(t => t.name === currentSongRef.current?.name && t.artist === currentSongRef.current?.artist);
    if (idx > 0) {
      setCurrentPlaying(playlist[idx - 1]);
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const results = [];
    const seenIds = new Set();

    savedPlaylists.forEach(pl => {
      pl.tracks.forEach(track => {
        const uniqueKey = `${track.name}-${track.artist}`;
        if (!seenIds.has(uniqueKey) && (track.name.toLowerCase().includes(query) || track.artist.toLowerCase().includes(query))) {
          results.push({ ...track, source: `Playlist: ${pl.name}` });
          seenIds.add(uniqueKey);
        }
      });
    });

    Object.values(favorites).flat().forEach(track => {
      const uniqueKey = `${track.name}-${track.artist}`;
      if (!seenIds.has(uniqueKey) && (track.name.toLowerCase().includes(query) || track.artist.toLowerCase().includes(query))) {
        results.push({ ...track, source: 'Favoritos' });
        seenIds.add(uniqueKey);
      }
    });

    return results;
  }, [searchQuery, savedPlaylists, favorites]);

  const toggleFavorite = (track, e) => {
    e?.stopPropagation();
    const moodId = track.moodId || selectedMood?.id;
    if (!moodId) return;
    const currentMoodFavorites = favorites[moodId] || [];
    const exists = currentMoodFavorites.find(t => t.name === track.name && t.artist === track.artist);
    let newFavorites;
    if (exists) {
      newFavorites = { ...favorites, [moodId]: currentMoodFavorites.filter(t => t.name !== track.name) };
    } else {
      newFavorites = { ...favorites, [moodId]: [...currentMoodFavorites, track] };
    }
    setFavorites(newFavorites);
  };

  const isFavorite = (track) => {
    const moodId = track.moodId || selectedMood?.id;
    if (!moodId || !favorites[moodId]) return false;
    return favorites[moodId].some(t => t.name === track.name && t.artist === track.artist);
  };

  const saveCurrentPlaylist = () => {
    if (!selectedMood || playlist.length === 0) return;
    setSavedPlaylists([{
      id: Date.now(),
      name: `Mix de ${selectedMood.label}`,
      date: new Date().toLocaleDateString(),
      mood: selectedMood,
      tracks: playlist,
      cover: selectedMood.coverImage || playlist[0]?.image 
    }, ...savedPlaylists]);
    alert("Playlist salva na Biblioteca!");
  };

  const deletePlaylist = (id, e) => {
    e.stopPropagation();
    if(confirm("Tem certeza?")) setSavedPlaylists(savedPlaylists.filter(p => p.id !== id));
  };

  const loadSavedPlaylist = (saved) => {
    setSelectedMood(saved.mood);
    setPlaylist(saved.tracks);
    setView('home');
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans flex overflow-hidden">
      
      <aside className="w-64 bg-[#030303] flex-col hidden md:flex border-r border-white/5">
        <div className="px-6 py-6 mb-4 cursor-pointer flex items-center" onClick={() => setView('home')}>
          
          <img 
            src="img/moodify-logo.png" 
            alt="Sua Logo" 
            className="h-10 w-auto object-contain hover:opacity-80 transition-opacity" 
            title="Moodify logo"
          />

        </div>
        <nav className="flex-1 px-3 space-y-1">
          <SidebarItem 
            icon={<Home size={24} />} 
            label="Início" 
            active={view === 'home' && !searchQuery} 
            onClick={() => { setView('home'); setSearchQuery(''); }} 
          />
          <SidebarItem 
            icon={<Compass size={24} />} 
            label="Explorar" 
            active={view === 'explore' && !searchQuery}
            onClick={() => { setView('explore'); setSearchQuery(''); }} 
          />
          <SidebarItem 
            icon={<Library size={24} />} 
            label="Biblioteca" 
            active={view === 'library' && !searchQuery} 
            onClick={() => { setView('library'); setSearchQuery(''); }} 
          />
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 bg-[#030303] sticky top-0 z-20 border-b border-white/5">
          <div className="md:hidden flex items-center gap-2">
             <span className="font-bold">Moodify</span>
          </div>
          <div className="flex-1 max-w-xl mx-4 hidden md:block">
            <div className="relative group">
              <Search className="h-5 w-5 text-neutral-500 absolute top-2.5 left-3 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Pesquisar na sua biblioteca..." 
                className="block w-full pl-10 pr-3 py-2 bg-[#212121] rounded-lg text-white focus:outline-none focus:bg-neutral-800 transition-all border border-transparent focus:border-white/10" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-neutral-300">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold cursor-pointer">A</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2 pb-32">
          {searchQuery ? (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Search size={20} className="text-red-500"/>
                Resultados para "{searchQuery}"
              </h2>
              {searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((track, i) => (
                    <TrackItem 
                      key={i} track={track} index={i} 
                      onPlay={() => handleSelectTrack(track)}
                      isFav={isFavorite(track)}
                      onToggleFav={(e) => toggleFavorite(track, e)}
                      isPlaying={currentPlaying?.name === track.name}
                      subtitle={track.source} 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-neutral-500">
                  <p>Nenhuma música encontrada nas suas playlists ou favoritos.</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {view === 'home' && (
                <>
                  <div className="mb-8 overflow-x-auto pb-4 no-scrollbar">
                    <div className="flex gap-3">
                      {MOODS.map((mood) => (
                        <button key={mood.id} onClick={() => generatePlaylist(mood)} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium border ${selectedMood?.id === mood.id ? 'bg-white text-black' : 'bg-[#212121] text-white border-[#333] hover:bg-[#333]'}`}>
                          {mood.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-6 mb-8 animate-fade-in">
                    <div className={`w-40 h-40 md:w-52 md:h-52 rounded-md shadow-2xl flex items-center justify-center flex-shrink-0 overflow-hidden ${selectedMood?.color || 'bg-neutral-800'}`}>
                        {selectedMood ? (
                          selectedMood.coverImage ? (
                            <img src={selectedMood.coverImage} className="w-full h-full object-cover" alt={selectedMood.label} onError={(e) => e.target.style.display = 'none'} />
                          ) : (
                            <p className="text-4xl font-bold text-white">{selectedMood.tag.slice(0, 2).toUpperCase()}</p>
                          )
                        ) : <Music size={48} className="text-white/20" />}
                    </div>
                    <div className="flex flex-col justify-end">
                        <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-2">Mix Automático</h2>
                        <h1 className="text-4xl font-bold mb-4">{selectedMood ? `Mix de ${selectedMood.label}` : "Selecione uma vibe"}</h1>
                        <div className="flex flex-wrap gap-3">
                          <button onClick={handlePlayPlaylist} className="bg-white text-black px-8 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors">
                              <Play fill="black" size={16} /> Tocar
                          </button>
                          
                          {selectedMood && (
                            <button 
                              onClick={() => generatePlaylist(selectedMood, true)} 
                              className="bg-[#212121] text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-[#333] transition-colors border border-white/10"
                              title="Gerar novas músicas para este humor"
                            >
                                <RefreshCw size={16} /> Nova Mix
                            </button>
                          )}

                          <button onClick={saveCurrentPlaylist} className="border border-neutral-600 px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-neutral-800 transition-colors">
                              <Library size={16} /> Salvar
                          </button>
                        </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {loading ? <div className="text-neutral-500 p-4">Carregando mix...</div> : 
                      playlist.map((track, i) => (
                        <TrackItem 
                          key={i} track={track} index={i} 
                          onPlay={() => handleSelectTrack(track)}
                          isFav={isFavorite(track)}
                          onToggleFav={(e) => toggleFavorite(track, e)}
                          isPlaying={currentPlaying?.name === track.name}
                        />
                      ))
                    }
                  </div>
                </>
              )}

              {view === 'explore' && (
                <div className="animate-fade-in">
                  <h1 className="text-3xl font-bold mb-6">Explorar Vibes</h1>
                  <p className="text-neutral-400 mb-8">Escolha seu estado de espírito e deixe a música rolar.</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {MOODS.map((mood) => (
                      <div 
                        key={mood.id} 
                        onClick={() => generatePlaylist(mood)}
                        className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all hover:scale-105"
                      >
                        {mood.coverImage ? (
                          <img 
                            src={mood.coverImage} 
                            alt={mood.label} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            onError={(e) => {e.target.style.display = 'none';}} 
                          />
                        ) : null}
                        <div className={`absolute inset-0 ${mood.color} opacity-60 group-hover:opacity-40 transition-opacity mix-blend-multiply`}></div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                          <h3 className="text-2xl font-bold text-white drop-shadow-md mb-2">{mood.label}</h3>
                          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                            <Play fill="black" size={20} className="ml-1"/>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {view === 'library' && (
                <div className="animate-fade-in">
                  <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
                    <button onClick={() => setLibraryTab('favorites')} className={`text-lg font-bold pb-2 transition-colors ${libraryTab === 'favorites' ? 'border-b-2 border-red-600 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Favoritos</button>
                    <button onClick={() => setLibraryTab('playlists')} className={`text-lg font-bold pb-2 transition-colors ${libraryTab === 'playlists' ? 'border-b-2 border-red-600 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Playlists</button>
                  </div>
                  
                  {libraryTab === 'favorites' && (
                    <div className="space-y-8">
                        {MOODS.map(mood => {
                          const favs = favorites[mood.id] || [];
                          if (!favs.length) return null;
                          return (
                            <div key={mood.id}>
                              <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-neutral-300">
                                <div className={`w-2 h-6 rounded-full ${mood.color}`}></div>
                                {mood.label}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {favs.map((t, i) => (
                                  <div key={i} onClick={() => handleSelectTrack(t)} className="flex gap-3 bg-[#181818] p-3 rounded hover:bg-[#282828] cursor-pointer group transition-colors">
                                      <img src={t.image || "https://placehold.co/50"} className="w-12 h-12 rounded object-cover shadow-sm" />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate text-white">{t.name}</p>
                                        <p className="text-xs text-neutral-400 truncate">{t.artist}</p>
                                      </div>
                                      <button className="p-2 hover:scale-110 transition-transform text-red-500">
                                        <Heart size={16} fill="currentColor" />
                                      </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                        {Object.keys(favorites).every(k => !favorites[k]?.length) && (
                          <div className="text-center text-neutral-500 py-10">Você ainda não tem músicas favoritas.</div>
                        )}
                    </div>
                  )}
                  
                  {libraryTab === 'playlists' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {savedPlaylists.map(pl => (
                          <div key={pl.id} onClick={() => loadSavedPlaylist(pl)} className="bg-[#181818] p-4 rounded-lg cursor-pointer hover:bg-[#282828] group transition-all">
                            <div className="aspect-square bg-neutral-800 mb-3 rounded-md overflow-hidden shadow-lg relative">
                                {pl.cover ? (
                                  <img src={pl.cover} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => {e.target.src = "https://placehold.co/300?text=Mood"}} />
                                ) : (
                                  <div className={`w-full h-full ${pl.mood.color} flex items-center justify-center`}><Music size={40} className="text-white/50" /></div>
                                )}
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Play fill="white" size={40} className="drop-shadow-lg" />
                                </div>
                            </div>
                            <h3 className="font-bold truncate text-white">{pl.name}</h3>
                            <p className="text-xs text-neutral-500 mb-2">{pl.tracks.length} faixas • {pl.date}</p>
                            <button onClick={(e) => deletePlaylist(pl.id, e)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 w-full justify-center py-1 border border-white/5 rounded hover:bg-white/5 transition-colors"><Trash2 size={12}/> Excluir</button>
                          </div>
                      ))}
                      {savedPlaylists.length === 0 && (
                          <div className="col-span-full text-center text-neutral-500 py-10">Nenhuma playlist salva.</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-24 bg-[#212121] border-t border-white/10 flex items-center justify-between px-0 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-4 w-full md:w-1/3 h-full px-4">
           {currentPlaying ? (
             <div className="flex items-center h-full w-full gap-4">
                <div className="h-14 w-14 relative group flex-shrink-0 bg-black">
                   
                   <img src={currentPlaying.image || "https://placehold.co/50"} className="w-full h-full object-cover rounded shadow-md absolute inset-0 z-0" />

                   <div className={isFullScreen 
                       ? "fixed inset-0 w-screen h-screen z-[100] bg-black flex items-center justify-center animate-fade-in" 
                       : "absolute inset-0 z-10 w-full h-full"}>
                      
                       <div id="youtube-player" className="w-full h-full"></div>

                       {isFullScreen && (
                        <button 
                          onClick={() => setIsFullScreen(false)}
                          className="absolute top-6 right-6 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full z-[101] border border-white/20 transition-all"
                        >
                           <Minimize2 size={32} />
                        </button>
                       )}
                   </div>
                </div>

                <div className="hidden sm:block min-w-0">
                   <h4 className="text-sm font-bold text-white line-clamp-1">{currentPlaying.name}</h4>
                   <p className="text-xs text-neutral-400 line-clamp-1">{currentPlaying.artist}</p>
                   {buffering && <span className="text-[10px] text-green-400">Carregando audio...</span>}
                </div>
                <button onClick={(e) => toggleFavorite(currentPlaying, e)} className="text-neutral-400 hover:text-white ml-2">
                   <Heart size={20} fill={isFavorite(currentPlaying) ? "#EF4444" : "none"} className={isFavorite(currentPlaying) ? "text-red-500" : ""} />
                </button>
             </div>
           ) : (
             <div className="flex items-center gap-4 text-neutral-500"><Music size={24}/><span className="text-sm">Selecione uma música</span></div>
           )}
        </div>

        <div className="flex flex-col items-center justify-center flex-1 h-full max-w-2xl px-4">
           <div className="flex items-center gap-6 mb-1">
              <button onClick={handlePrev} className="text-neutral-400 hover:text-white"><SkipBack size={24} /></button>
              <button onClick={handlePlayPause} className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform text-black">
                 {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
              </button>
              <button onClick={handleNext} className="text-neutral-400 hover:text-white"><SkipForward size={24} /></button>
           </div>
           
           <div className="w-full flex items-center gap-3 text-xs text-neutral-400 font-mono">
              <span>{formatTime(currentTime)}</span>
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={handleSeek}
                className="flex-1 h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-red-600 hover:accent-red-500"
              />
              <span>{formatTime(duration)}</span>
           </div>
        </div>

        <div className="hidden md:flex items-center gap-4 w-1/3 justify-end px-6 text-neutral-400">
           <button onClick={toggleMute} className="hover:text-white">
             {isMuted || volume === 0 ? <VolumeX size={20} /> : volume < 50 ? <Volume1 size={20} /> : <Volume2 size={20} />}
           </button>
           <input 
             type="range" 
             min="0" 
             max="100" 
             value={isMuted ? 0 : volume} 
             onChange={handleVolumeChange}
             className="w-24 h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-white hover:accent-gray-200"
           />
           <button onClick={() => setIsFullScreen(!isFullScreen)} title="Ver vídeo oficial" className={`hover:text-white cursor-pointer ml-2 ${isFullScreen ? 'text-red-500' : ''}`}>
             {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
           </button>
        </div>
      </footer>
    </div>
  );
}

function TrackItem({ track, index, onPlay, isFav, onToggleFav, isPlaying, subtitle }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const copyToClipboard = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${track.artist} - ${track.name}`);
    alert("Copiado para a área de transferência!");
    setShowMenu(false);
  };

  const searchOnGoogle = (e) => {
    e.stopPropagation();
    window.open(`https://www.google.com/search?q=${track.artist}+${track.name}+lyrics`, '_blank');
    setShowMenu(false);
  };

  return (
    <div 
      onClick={onPlay} 
      className={`group flex items-center gap-4 p-2 rounded-md cursor-pointer transition-colors relative ${isPlaying ? 'bg-white/10' : 'hover:bg-[#181818]'}`}
    >
      <span className="w-6 text-center text-sm text-neutral-500 group-hover:hidden">
        {isPlaying ? <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mx-auto"></div> : index + 1}
      </span>
      <Play size={16} fill="white" className="w-6 hidden group-hover:block text-white" />
      <img src={track.image || "https://placehold.co/50"} className="w-12 h-12 rounded object-cover shadow-sm" />
      <div className="flex-1 min-w-0">
          <h4 className={`font-medium truncate ${isPlaying ? 'text-red-500' : 'text-white'}`}>{track.name}</h4>
          <div className="flex items-center gap-2">
            <p className="text-sm text-neutral-400 truncate">{track.artist}</p>
            {subtitle && <span className="text-xs text-neutral-600">• {subtitle}</span>}
          </div>
      </div>
      <div className="hidden md:block text-sm text-neutral-400 w-48 truncate">{track.name}</div>
      <div className="flex items-center gap-4">
        <button onClick={onToggleFav} className={`p-2 hover:scale-110 transition-transform ${isFav ? 'text-red-500' : 'text-neutral-500 hover:text-white'}`}>
          <Heart size={20} fill={isFav ? "currentColor" : "none"} />
        </button>
      </div>
      
      <div className="relative" ref={menuRef}>
        <button 
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/10"
        >
          <MoreVertical size={20} />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-[#282828] rounded shadow-xl border border-white/5 z-50 overflow-hidden">
            <button 
              onClick={onToggleFav}
              className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex items-center gap-2"
            >
              <Heart size={14} /> {isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
            </button>
            <button 
              onClick={copyToClipboard}
              className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex items-center gap-2"
            >
              <Copy size={14} /> Copiar Nome
            </button>
            <button 
              onClick={searchOnGoogle}
              className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex items-center gap-2"
            >
              <ExternalLink size={14} /> Ver Letra (Google)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SidebarItem({ icon, label, active = false, onClick }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-4 px-3 py-3 rounded-lg cursor-pointer transition-colors ${active ? 'bg-[#181818] text-white' : 'text-neutral-400 hover:bg-[#181818] hover:text-white'}`}>
      {icon} <span className={`text-sm font-medium ${active ? 'font-bold' : ''}`}>{label}</span>
    </div>
  );
}