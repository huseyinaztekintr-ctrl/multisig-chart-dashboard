import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { BookOpen, Save, Trash2, ChevronDown, Bell, Plus, X, TrendingUp, TrendingDown, Calendar, PartyPopper, Edit } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getEnabledTokens } from './TokenManager';
import { fetchDexScreenerPrice } from '@/utils/blockchain';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

const NOTES_STORAGE_KEY = 'order-position-notes';
const ALARMS_STORAGE_KEY = 'order-position-alarms';

interface Note {
  id: string;
  title: string;
  content: string;
  date?: string;
  hasAlarm: boolean;
  createdAt: string;
}

interface Alarm {
  id: string;
  type: 'price' | 'date';
  title: string;
  tokenSymbol?: string;
  tokenPairAddress?: string;
  tokenAddress?: string;
  targetPrice?: number;
  condition?: 'above' | 'below';
  targetDate?: string;
  triggered: boolean;
  createdAt: string;
  useMarketValue?: boolean;
  supply?: number;
  currency?: 'usd' | 'wavax';
}

export const PositionNotes = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showAlarmForm, setShowAlarmForm] = useState(false);
  const [alarmType, setAlarmType] = useState<'price' | 'date'>('price');
  const [alarmTitle, setAlarmTitle] = useState('');
  const [selectedToken, setSelectedToken] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [priceCondition, setPriceCondition] = useState<'above' | 'below'>('above');
  const [targetDate, setTargetDate] = useState('');
  const [useMarketValue, setUseMarketValue] = useState(false);
  const [supply, setSupply] = useState('');
  const [currency, setCurrency] = useState<'usd' | 'wavax'>('usd');
  
  // Note form states
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [noteHasAlarm, setNoteHasAlarm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const [alarmMessage, setAlarmMessage] = useState('');
  const [alarmImage, setAlarmImage] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // Load notes and alarms from localStorage
    const savedNotes = localStorage.getItem(NOTES_STORAGE_KEY);
    let loadedNotes: Note[] = [];
    
    if (savedNotes) {
      try {
        loadedNotes = JSON.parse(savedNotes);
      } catch (e) {
        console.error('Error loading notes:', e);
      }
    }
    
    // Check if OrderBuyback note exists
    const hasOrderBuyback = loadedNotes.some(note => note.title === 'OrderBuyback');
    
    // Add default OrderBuyback note if it doesn't exist
    if (!hasOrderBuyback) {
      const defaultNote: Note = {
        id: 'default-orderbuyback',
        title: 'OrderBuyback',
        content: `Multi-Wallet Airdrop'dan bütün prv.keylere AVAX GAS 0,1
Multi-Wallet Airdrop'dan WAVAX gönder, bütçeye göre.
SwapBot 1.private'nin alt hesabıdır.

Kar geldikçe sürekli alım olacak sistem;
Günde 1440 kez; 1'dk : 1440*0,000090: 0,12 AVAX Gas.
SwapBot 1440 ayarlı 60 saniye ayarlı Wavax ayarlı.

2K WAVAX,USDC,ARENA farketmez, AnaMultisig'e OrderBuyBack.
Bu değer : bir sonraki kazanç aşamasına kadar bölünür en az değer 2K AVAX , en fazla süre 90 Gün.

Haftalık veya 3-4 günde bir DOLUM Yapılır Hack riskine karşı.`,
        hasAlarm: false,
        createdAt: new Date().toISOString(),
      };
      loadedNotes = [defaultNote, ...loadedNotes];
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(loadedNotes));
    }
    
    setNotes(loadedNotes);
    if (loadedNotes.length > 0 && !activeNoteId) {
      setActiveNoteId(loadedNotes[0].id);
    }

    const savedAlarms = localStorage.getItem(ALARMS_STORAGE_KEY);
    if (savedAlarms) {
      try {
        setAlarms(JSON.parse(savedAlarms));
      } catch (e) {
        console.error('Error loading alarms:', e);
      }
    }
  }, []);

  // Check alarms periodically
  useEffect(() => {
    const checkAlarms = async () => {
      const now = new Date();
      const updatedAlarms = [...alarms];
      let hasTriggered = false;

      for (let i = 0; i < updatedAlarms.length; i++) {
        const alarm = updatedAlarms[i];
        if (alarm.triggered) continue;

        if (alarm.type === 'date' && alarm.targetDate) {
          const targetDateTime = new Date(alarm.targetDate);
          // Compare dates without being too strict about milliseconds
          if (now >= targetDateTime) {
            updatedAlarms[i].triggered = true;
            hasTriggered = true;
            const formattedDate = targetDateTime.toLocaleString('tr-TR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            showNotification(alarm.title, `Tarih alarmı: ${formattedDate}`, alarm);
          }
        } else if (alarm.type === 'price' && alarm.targetPrice) {
          try {
            let currentValue = 0;
            
            // Get token price
            let tokenPrice = 0;
            
            if (alarm.tokenSymbol === 'BTC.b') {
              // BTC.b special case - use pair address to get BTC price
              const btcPairAddress = '0x856b38Bf1e2E367F747DD4d3951DDA8a35F1bF60';
              const btcPriceData = await fetchDexScreenerPrice(btcPairAddress);
              tokenPrice = btcPriceData.price;
            } else if (alarm.tokenSymbol === 'USDC' || alarm.tokenSymbol === 'DAI.e' || alarm.tokenSymbol === 'GHO') {
              tokenPrice = 1;
            } else if (alarm.tokenPairAddress) {
              const priceData = await fetchDexScreenerPrice(alarm.tokenPairAddress);
              tokenPrice = priceData.price;
            }
            
            if (tokenPrice === 0) {
              continue; // Skip if price not available
            }
            
            if (alarm.useMarketValue && alarm.supply) {
              // Market value alarm: supply * price
              if (alarm.currency === 'wavax') {
                const avaxPriceData = await fetchDexScreenerPrice('0x864d4e5ee7318e97483db7eb0912e09f161516ea');
                currentValue = (alarm.supply * tokenPrice) / avaxPriceData.price;
              } else {
                currentValue = alarm.supply * tokenPrice;
              }
            } else {
              // Price alarm
              if (alarm.currency === 'wavax') {
                const avaxPriceData = await fetchDexScreenerPrice('0x864d4e5ee7318e97483db7eb0912e09f161516ea');
                currentValue = tokenPrice / avaxPriceData.price;
              } else {
                currentValue = tokenPrice;
              }
            }
            
            const shouldTrigger = alarm.condition === 'above' 
              ? currentValue >= alarm.targetPrice 
              : currentValue <= alarm.targetPrice;
            
            if (shouldTrigger) {
              updatedAlarms[i].triggered = true;
              hasTriggered = true;
              const conditionText = alarm.condition === 'above' ? 'üstüne çıktı' : 'altına düştü';
              const currencySymbol = alarm.currency === 'wavax' ? 'WAVAX' : '$';
              const valueType = alarm.useMarketValue ? 'Market değeri' : 'Fiyatı';
              showNotification(
                alarm.title,
                `${alarm.tokenSymbol} ${valueType} ${currencySymbol}${currentValue.toFixed(6)} ${conditionText}`,
                alarm
              );
            }
          } catch (e) {
            console.error('Error checking price alarm:', e);
          }
        }
      }

      if (hasTriggered) {
        setAlarms(updatedAlarms);
        localStorage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(updatedAlarms));
      }
    };

    const interval = setInterval(checkAlarms, 30000); // Check every 30 seconds
    checkAlarms(); // Initial check

    return () => clearInterval(interval);
  }, [alarms]);

  // Listen for external alarm updates (from navbar dialog)
  useEffect(() => {
    const reload = () => {
      const savedAlarms = localStorage.getItem(ALARMS_STORAGE_KEY);
      if (savedAlarms) {
        try { setAlarms(JSON.parse(savedAlarms)); } catch (e) { console.error('Error loading alarms:', e); }
      }
    };
    window.addEventListener('alarms-updated', reload as any);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('alarms-updated', reload as any);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const showNotification = async (title: string, body: string, alarm: Alarm) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/order-logo.png' });
    }
    toast({
      title,
      description: body,
    });
    
    // Show alarm popup
    setAlarmMessage(body);
    setActiveAlarm(alarm);
    setAlarmImage(''); // Reset image
    
    // Play alarm sound (loop)
    if (!audioRef.current) {
      audioRef.current = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
      audioRef.current.loop = true;
    }
    audioRef.current.play().catch(e => console.error('Error playing alarm:', e));
    
    // Generate AI image
    try {
      const { data, error } = await supabase.functions.invoke('alarm-image', {
        body: { 
          title, 
          message: body,
          tokenSymbol: alarm.tokenSymbol 
        }
      });
      
      if (!error && data?.imageUrl) {
        setAlarmImage(data.imageUrl);
      }
    } catch (error) {
      console.error('Error generating alarm image:', error);
    }
    
    // Generate AI TTS - for date alarms with notes, find and include note content
    try {
      let ttsText = `${title}. ${body}`;
      
      // If it's a date alarm (from a note), try to include note content
      if (alarm.type === 'date') {
        const relatedNote = notes.find(n => n.title === alarm.title && n.hasAlarm);
        if (relatedNote && relatedNote.content) {
          ttsText = `${title}. ${relatedNote.content}. ${body}`;
        }
      }
      
      const { data, error } = await supabase.functions.invoke('alarm-tts', {
        body: { text: ttsText }
      });
      
      if (!error && data?.text) {
        // Use browser's speech synthesis with the processed text
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(data.text);
          utterance.lang = 'tr-TR';
          utterance.rate = 1.0;
          utterance.pitch = 1.1;
          utterance.volume = 1;
          
          // Repeat speech every 5 seconds
          const speakInterval = setInterval(() => {
            if (activeAlarm) {
              window.speechSynthesis.speak(utterance);
            }
          }, 5000);
          
          window.speechSynthesis.speak(utterance);
          
          // Store interval for cleanup
          (speechAudioRef.current as any) = speakInterval;
        }
      }
    } catch (error) {
      console.error('Error generating alarm TTS:', error);
    }
  };
  
  const stopAlarm = () => {
    // Stop audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Stop speech
    window.speechSynthesis.cancel();
    if ((speechAudioRef.current as any)) {
      clearInterval((speechAudioRef.current as any));
      (speechAudioRef.current as any) = null;
    }
    
    // Close dialog
    setActiveAlarm(null);
    setAlarmMessage('');
    setAlarmImage('');
  };

  const saveNote = () => {
    if (!noteTitle.trim()) {
      toast({
        title: "Hata",
        description: "Not başlığı gerekli",
        variant: "destructive",
      });
      return;
    }

    if (noteHasAlarm && !noteDate) {
      toast({
        title: "Hata",
        description: "Alarm için tarih seçmelisiniz",
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    
    if (editingNoteId) {
      // Update existing note
      const updatedNotes = notes.map(note => 
        note.id === editingNoteId 
          ? { ...note, title: noteTitle, content: noteContent, date: noteDate, hasAlarm: noteHasAlarm }
          : note
      );
      setNotes(updatedNotes);
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updatedNotes));
      
      toast({
        title: "Not güncellendi",
        description: "Notunuz başarıyla güncellendi.",
      });
    } else {
      // Create new note
      const newNote: Note = {
        id: Date.now().toString(),
        title: noteTitle,
        content: noteContent,
        date: noteDate || undefined,
        hasAlarm: noteHasAlarm,
        createdAt: now.toISOString(),
      };
      
      const updatedNotes = [...notes, newNote];
      setNotes(updatedNotes);
      setActiveNoteId(newNote.id);
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updatedNotes));
      
      // Create alarm if needed
      if (noteHasAlarm && noteDate) {
        const newAlarm: Alarm = {
          id: Date.now().toString() + '-alarm',
          type: 'date',
          title: noteTitle,
          targetDate: noteDate,
          triggered: false,
          createdAt: now.toISOString(),
        };
        const updatedAlarms = [...alarms, newAlarm];
        setAlarms(updatedAlarms);
        localStorage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(updatedAlarms));
      }
      
      toast({
        title: "Not eklendi",
        description: "Yeni notunuz başarıyla oluşturuldu.",
      });
    }
    
    // Reset form
    setNoteTitle('');
    setNoteContent('');
    setNoteDate('');
    setNoteHasAlarm(false);
    setEditingNoteId(null);
    setShowNoteDialog(false);
  };

  const deleteNote = (id: string) => {
    if (window.confirm('Bu notu silmek istediğinize emin misiniz?')) {
      const updatedNotes = notes.filter(n => n.id !== id);
      setNotes(updatedNotes);
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updatedNotes));
      
      if (activeNoteId === id && updatedNotes.length > 0) {
        setActiveNoteId(updatedNotes[0].id);
      }
      
      toast({
        title: "Not silindi",
        description: "Not başarıyla silindi.",
        variant: "destructive",
      });
    }
  };

  const startEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteDate(note.date || '');
    setNoteHasAlarm(note.hasAlarm);
    setShowNoteDialog(true);
  };

  const addAlarm = () => {
    if (!alarmTitle.trim()) {
      toast({
        title: "Hata",
        description: "Alarm başlığı gerekli",
        variant: "destructive",
      });
      return;
    }

    const tokens = getEnabledTokens();
    const selectedTokenData = tokens.find(t => t.symbol === selectedToken);

    if (alarmType === 'price') {
      if (!selectedToken || !targetPrice) {
        toast({
          title: "Hata",
          description: "Lütfen tüm alanları doldurun",
          variant: "destructive",
        });
        return;
      }
      
      if (useMarketValue && !supply) {
        toast({
          title: "Hata",
          description: "Market değeri alarmı için supply girmelisiniz",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!targetDate) {
        toast({
          title: "Hata",
          description: "Lütfen tarih seçin",
          variant: "destructive",
        });
        return;
      }
    }

    const newAlarm: Alarm = {
      id: Date.now().toString(),
      type: alarmType,
      title: alarmTitle,
      ...(alarmType === 'price' ? {
        tokenSymbol: selectedToken,
        tokenPairAddress: selectedTokenData?.pairAddress,
        tokenAddress: selectedTokenData?.address,
        targetPrice: parseFloat(targetPrice),
        condition: priceCondition,
        useMarketValue,
        supply: useMarketValue ? parseFloat(supply) : undefined,
        currency,
      } : {
        targetDate,
      }),
      triggered: false,
      createdAt: new Date().toISOString(),
    };

    const updatedAlarms = [...alarms, newAlarm];
    setAlarms(updatedAlarms);
    localStorage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(updatedAlarms));

    // Reset form
    setAlarmTitle('');
    setSelectedToken('');
    setTargetPrice('');
    setTargetDate('');
    setUseMarketValue(false);
    setSupply('');
    setCurrency('usd');
    setShowAlarmForm(false);

    toast({
      title: "Alarm eklendi",
      description: "Alarm başarıyla oluşturuldu",
    });
  };

  const deleteAlarm = (id: string) => {
    const updatedAlarms = alarms.filter(a => a.id !== id);
    setAlarms(updatedAlarms);
    localStorage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(updatedAlarms));
    toast({
      title: "Alarm silindi",
      description: "Alarm başarıyla silindi",
    });
  };

  return (
    <>
      <Dialog open={!!activeAlarm} onOpenChange={(open) => !open && stopAlarm()}>
        <DialogContent className="sm:max-w-2xl bg-gradient-to-br from-order-green/20 via-emerald-500/20 to-green-600/20 border-2 border-order-green shadow-2xl shadow-order-green/50 backdrop-blur-md overflow-hidden">
          {/* Background animation */}
          <div className="absolute inset-0 bg-gradient-to-br from-order-green/10 to-transparent animate-pulse" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(61,214,140,0.1),transparent_50%)] animate-pulse" style={{ animationDelay: '0.5s' }} />
          
          <DialogHeader className="relative z-10">
            <DialogTitle className="flex items-center gap-3 text-3xl text-order-green animate-bounce">
              <PartyPopper className="w-10 h-10 animate-spin" style={{ animationDuration: '3s' }} />
              <span className="bg-gradient-to-r from-order-green via-emerald-400 to-green-500 bg-clip-text text-transparent font-black">
                TEBRİKLER! 🎉
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-6 py-6 relative z-10">
            {activeAlarm && (
              <>
                {/* AI Generated Image or Token Logo */}
                <div className="relative w-full max-w-md">
                  {alarmImage ? (
                    <div className="relative rounded-2xl overflow-hidden ring-4 ring-order-green/50 shadow-2xl">
                      <img 
                        src={alarmImage}
                        alt="Alarm visualization"
                        className="w-full h-48 object-cover animate-fade-in"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-order-green/50 to-transparent" />
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      {activeAlarm.tokenSymbol && getEnabledTokens().find(t => t.symbol === activeAlarm.tokenSymbol)?.logo ? (
                        <div className="relative">
                          <img 
                            src={getEnabledTokens().find(t => t.symbol === activeAlarm.tokenSymbol)?.logo} 
                            alt={activeAlarm.tokenSymbol}
                            className="w-32 h-32 rounded-full ring-8 ring-order-green/50 shadow-2xl animate-pulse"
                          />
                          <div className="absolute inset-0 rounded-full bg-order-green/20 animate-ping" />
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="w-32 h-32 rounded-full ring-8 ring-order-green/50 shadow-2xl animate-pulse bg-gradient-to-br from-order-green/30 to-emerald-500/30 flex items-center justify-center backdrop-blur-sm">
                            <Bell className="w-16 h-16 text-order-green animate-bounce" />
                          </div>
                          <div className="absolute inset-0 rounded-full bg-order-green/20 animate-ping" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Alarm Details */}
                <div className="text-center space-y-4 max-w-lg">
                  <h3 className="text-4xl font-black text-order-green animate-bounce bg-gradient-to-r from-order-green via-emerald-400 to-green-500 bg-clip-text text-transparent">
                    {activeAlarm.title}
                  </h3>
                  <p className="text-2xl text-foreground font-bold px-4 py-3 bg-background/50 rounded-xl border-2 border-order-green/30 backdrop-blur-sm shadow-lg">
                    {alarmMessage}
                  </p>
                  
                  {/* Animated Emojis */}
                  <div className="flex flex-wrap gap-3 justify-center mt-6">
                    {['🎊', '🎉', '🚀', '💰', '📈', '✨', '🔥', '💎'].map((emoji, i) => (
                      <span 
                        key={i} 
                        className="text-5xl animate-bounce drop-shadow-2xl"
                        style={{ 
                          animationDelay: `${i * 0.15}s`,
                          animationDuration: '1s'
                        }}
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Action Button */}
          <div className="flex gap-3 relative z-10">
            <Button
              onClick={stopAlarm}
              size="lg"
              className="flex-1 bg-gradient-to-r from-order-green via-emerald-500 to-green-600 hover:from-order-green/90 hover:via-emerald-500/90 hover:to-green-600/90 text-white font-black text-xl py-8 shadow-2xl shadow-order-green/50 border-2 border-order-green/30 transition-all hover:scale-105"
            >
              ✓ ALARMI KAPAT
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="sm:max-w-lg bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-cyan-500/20 border-2 border-purple-500/50 shadow-2xl shadow-purple-500/50 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              {editingNoteId ? '📝 Not Düzenle' : '✨ Yeni Not Ekle'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Başlık *</Label>
              <Input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Not başlığı..."
                className="bg-background/50 border-purple-500/30 focus:border-purple-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">İçerik</Label>
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Not içeriği...&#10;&#10;Örnek:&#10;• Giriş fiyatı: $0.00045&#10;• Hedef: $0.001&#10;• Stop loss: $0.0003"
                className="min-h-[150px] bg-background/50 border-purple-500/30 focus:border-purple-500 transition-all font-mono text-sm"
              />
            </div>

            <div className="space-y-3 p-4 bg-background/30 rounded-lg border border-cyan-500/30">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={noteHasAlarm}
                  onChange={(e) => setNoteHasAlarm(e.target.checked)}
                  className="w-4 h-4 rounded border-cyan-500/50"
                  id="noteAlarm"
                />
                <Label htmlFor="noteAlarm" className="text-sm font-semibold text-foreground cursor-pointer flex items-center gap-2">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  Alarm Ekle (İsteğe Bağlı)
                </Label>
              </div>

              {noteHasAlarm && (
                <div className="space-y-2 pl-6">
                  <Label className="text-xs text-muted-foreground">Alarm Tarihi ve Saati</Label>
                  <Input
                    type="datetime-local"
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                    className="bg-background/50 border-cyan-500/30 focus:border-cyan-500"
                  />
                  <p className="text-xs text-cyan-400">
                    💡 Belirlediğiniz tarihte bildirim alacaksınız
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={saveNote}
                className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 text-white font-bold shadow-lg shadow-purple-500/50 transition-all"
              >
                {editingNoteId ? 'Güncelle' : 'Kaydet'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNoteDialog(false);
                  setEditingNoteId(null);
                  setNoteTitle('');
                  setNoteContent('');
                  setNoteDate('');
                  setNoteHasAlarm(false);
                }}
                className="border-purple-500/30 hover:bg-purple-500/10"
              >
                İptal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    <Card className="p-5 gradient-card border-primary/30 glow-order group hover:border-primary/50 transition-all duration-300">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1">
            <BookOpen className="w-6 h-6 text-order-green animate-pulse-slow" />
            <h2 className="text-lg font-bold text-foreground">Pozisyon Notları</h2>
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          {isOpen && (
            <Button
              size="sm"
              onClick={() => setShowNoteDialog(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30"
            >
              <Plus className="w-4 h-4 mr-1" />
              Yeni Not
            </Button>
          )}
        </div>

        <CollapsibleContent className="mt-4">
          <Tabs defaultValue="alarms" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="alarms" className="text-xs">
                🔔 Alarmlar
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs">
                📝 Notlar
              </TabsTrigger>
            </TabsList>

            {/* Alarms Tab */}
            <TabsContent value="alarms" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Bell className="w-4 h-4 text-order-green" />
                  Alarmlar
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAlarmForm(!showAlarmForm)}
                  className="hover:bg-order-green/10 hover:text-order-green transition-all"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Alarm Form */}
              {showAlarmForm && (
                <div className="p-4 bg-background/50 rounded-lg border border-border/50 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Alarm Türü</Label>
                    <Select value={alarmType} onValueChange={(v) => setAlarmType(v as 'price' | 'date')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="price">Fiyat Bazlı</SelectItem>
                        <SelectItem value="date">Tarih Bazlı</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Başlık</Label>
                    <Input
                      value={alarmTitle}
                      onChange={(e) => setAlarmTitle(e.target.value)}
                      placeholder="Alarm açıklaması"
                      className="bg-background/50"
                    />
                  </div>

                  {alarmType === 'price' ? (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">Token (Multisig Holdingleri)</Label>
                        <Select value={selectedToken} onValueChange={setSelectedToken}>
                          <SelectTrigger>
                            <SelectValue placeholder="Multisig'den token seçin" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {getEnabledTokens().map((token) => (
                              <SelectItem key={token.symbol} value={token.symbol}>
                                <div className="flex items-center gap-2">
                                  <img src={token.logo} alt={token.symbol} className="w-4 h-4 rounded-full" />
                                  {token.symbol}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Tüm multisig tokenlerini seçebilirsiniz
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={useMarketValue}
                            onChange={(e) => setUseMarketValue(e.target.checked)}
                            className="rounded border-border"
                          />
                          Market Değeri Kullan (Supply × Fiyat)
                        </Label>
                        {useMarketValue && (
                          <Input
                            type="number"
                            value={supply}
                            onChange={(e) => setSupply(e.target.value)}
                            placeholder="Token supply miktarı"
                            className="bg-background/50"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Para Birimi</Label>
                        <Select value={currency} onValueChange={(v) => setCurrency(v as 'usd' | 'wavax')}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="usd">USD ($)</SelectItem>
                            <SelectItem value="wavax">WAVAX</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Koşul</Label>
                          <Select value={priceCondition} onValueChange={(v) => setPriceCondition(v as 'above' | 'below')}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="above">
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  Üstüne çıkınca
                                </div>
                              </SelectItem>
                              <SelectItem value="below">
                                <div className="flex items-center gap-2">
                                  <TrendingDown className="w-4 h-4" />
                                  Altına düşünce
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Hedef {useMarketValue ? 'Değer' : 'Fiyat'}</Label>
                          <Input
                            type="number"
                            step="0.000001"
                            value={targetPrice}
                            onChange={(e) => setTargetPrice(e.target.value)}
                            placeholder="0.00"
                            className="bg-background/50"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs">Tarih ve Saat</Label>
                      <Input
                        type="datetime-local"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={addAlarm} className="flex-1">
                      <Plus className="w-4 h-4 mr-2" />
                      Ekle
                    </Button>
                    <Button variant="outline" onClick={() => setShowAlarmForm(false)}>
                      İptal
                    </Button>
                  </div>
                </div>
              )}

              {/* Alarm List */}
              <div className="space-y-2">
                {alarms.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Henüz alarm eklenmemiş
                  </p>
                ) : (
                  alarms.map((alarm) => (
                    <div
                      key={alarm.id}
                      className={`p-3 rounded-lg border transition-all ${
                        alarm.triggered
                          ? 'bg-order-green/10 border-order-green/30'
                          : 'bg-background/50 border-border/50 hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {alarm.type === 'price' ? (
                              <TrendingUp className="w-3 h-3 text-corporate-blue flex-shrink-0" />
                            ) : (
                              <Calendar className="w-3 h-3 text-corporate-blue flex-shrink-0" />
                            )}
                            <p className="text-sm font-semibold text-foreground truncate">
                              {alarm.title}
                            </p>
                          </div>
                          {alarm.type === 'price' ? (
                            <p className="text-xs text-muted-foreground">
                              {alarm.tokenSymbol} {alarm.condition === 'above' ? '↑' : '↓'} 
                              {alarm.currency === 'wavax' ? ' ' : '$'}{alarm.targetPrice}
                              {alarm.currency === 'wavax' ? ' WAVAX' : ''}
                              {alarm.useMarketValue && ` (Market: ${alarm.supply?.toLocaleString()} supply)`}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {new Date(alarm.targetDate!).toLocaleString('tr-TR')}
                            </p>
                          )}
                          {alarm.triggered && (
                            <span className="text-xs text-order-green font-semibold">✓ Tetiklendi</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteAlarm(alarm.id)}
                          className="hover:bg-red-500/10 hover:text-red-500 transition-all flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-order-green" />
                Notlar
              </h3>

              {notes.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Henüz not eklenmemiş
                  </p>
                  <Button
                    onClick={() => setShowNoteDialog(true)}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    İlk Notunu Ekle
                  </Button>
                </div>
              ) : (
                <Tabs value={activeNoteId} onValueChange={setActiveNoteId} className="w-full">
                  <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-background/50">
                    {notes.map((note) => (
                      <TabsTrigger 
                        key={note.id} 
                        value={note.id}
                        className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/20 data-[state=active]:to-pink-500/20 data-[state=active]:text-foreground whitespace-nowrap"
                      >
                        {note.hasAlarm && <Bell className="w-3 h-3 mr-1 text-cyan-400" />}
                        {note.title}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {notes.map((note) => (
                    <TabsContent key={note.id} value={note.id} className="space-y-3 mt-3">
                      <div className="flex items-start justify-between gap-2 p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground">{note.title}</h4>
                            {note.hasAlarm && note.date && (
                              <span className="text-xs text-cyan-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(note.date).toLocaleString('tr-TR')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                            {note.content || 'İçerik yok'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Oluşturulma: {new Date(note.createdAt).toLocaleString('tr-TR')}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditNote(note)}
                            className="hover:bg-purple-500/10 hover:text-purple-400 transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteNote(note.id)}
                            className="hover:bg-red-500/10 hover:text-red-500 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              )}

              <p className="text-xs text-muted-foreground italic">
                💡 İpucu: Notlarınız ve alarmlarınız otomatik olarak tarayıcınızda saklanır
              </p>
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>
    </Card>
    </>
  );
};
 