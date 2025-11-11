import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Bell, TrendingUp, TrendingDown, Save, Trash2, Calendar } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'trading-notes-';
const ALARM_KEY_PREFIX = 'trading-alarms-';

interface TradingNote {
  id: string;
  type: 'BUY' | 'SELL' | 'HODL' | 'AL' | 'SAT' | 'TARİH';
  content: string;
  price?: number;
  date?: string;
  createdAt: string;
}

interface PriceAlarm {
  id: string;
  type: 'destek' | 'direnç';
  targetPrice: number;
  condition: 'above' | 'below';
  triggered: boolean;
  createdAt: string;
}

interface TradingNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  currentPrice: number;
  pairAddress: string;
}

export const TradingNoteDialog = ({ 
  open, 
  onOpenChange, 
  symbol, 
  currentPrice,
  pairAddress 
}: TradingNoteDialogProps) => {
  const [notes, setNotes] = useState<TradingNote[]>([]);
  const [alarms, setAlarms] = useState<PriceAlarm[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<TradingNote['type']>('BUY');
  const [notePrice, setNotePrice] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [alarmPrice, setAlarmPrice] = useState('');
  const [alarmType, setAlarmType] = useState<'destek' | 'direnç'>('destek');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadNotes();
      loadAlarms();
    }
  }, [open, symbol]);

  const loadNotes = () => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${symbol}`);
    if (saved) {
      try {
        setNotes(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading notes:', e);
      }
    }
  };

  const loadAlarms = () => {
    const saved = localStorage.getItem(`${ALARM_KEY_PREFIX}${symbol}`);
    if (saved) {
      try {
        setAlarms(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading alarms:', e);
      }
    }
  };

  const saveNote = () => {
    const newNote: TradingNote = {
      id: Date.now().toString(),
      type: noteType,
      content: noteContent.trim() || `${noteType} sinyali`,
      price: notePrice ? parseFloat(notePrice) : undefined,
      date: noteDate || undefined,
      createdAt: new Date().toISOString(),
    };

    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${symbol}`, JSON.stringify(updatedNotes));

    // Trigger custom event for immediate UI update
    window.dispatchEvent(new Event(`notes-updated-${symbol}`));

    setNoteContent('');
    setNotePrice('');
    setNoteDate('');

    toast({
      title: "Not eklendi",
      description: `${symbol} için ${noteType} notu kaydedildi`,
    });
  };

  const deleteNote = (id: string) => {
    const updatedNotes = notes.filter(n => n.id !== id);
    setNotes(updatedNotes);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${symbol}`, JSON.stringify(updatedNotes));
    
    // Trigger custom event for immediate UI update
    window.dispatchEvent(new Event(`notes-updated-${symbol}`));
    
    toast({
      title: "Not silindi",
      variant: "destructive",
    });
  };

  const addAlarm = () => {
    if (!alarmPrice) {
      toast({
        title: "Hata",
        description: "Alarm fiyatı giriniz",
        variant: "destructive",
      });
      return;
    }

    const price = parseFloat(alarmPrice);
    const condition = alarmType === 'destek' ? 'below' : 'above';

    const newAlarm: PriceAlarm = {
      id: Date.now().toString(),
      type: alarmType,
      targetPrice: price,
      condition,
      triggered: false,
      createdAt: new Date().toISOString(),
    };

    const updatedAlarms = [...alarms, newAlarm];
    setAlarms(updatedAlarms);
    localStorage.setItem(`${ALARM_KEY_PREFIX}${symbol}`, JSON.stringify(updatedAlarms));

    // Also save to global alarms for PositionNotes component to check
    const globalAlarms = JSON.parse(localStorage.getItem('order-position-alarms') || '[]');
    globalAlarms.push({
      id: newAlarm.id,
      type: 'price',
      title: `${symbol} ${alarmType} alarmı`,
      tokenSymbol: symbol,
      tokenPairAddress: pairAddress,
      targetPrice: price,
      condition,
      triggered: false,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('order-position-alarms', JSON.stringify(globalAlarms));

    // Trigger custom event for immediate UI update
    window.dispatchEvent(new Event(`notes-updated-${symbol}`));
    window.dispatchEvent(new Event('alarms-updated'));

    setAlarmPrice('');

    toast({
      title: "Alarm eklendi",
      description: `${symbol} için ${alarmType} alarmı: $${price.toFixed(2)}`,
    });
  };

  const deleteAlarm = (id: string) => {
    const updatedAlarms = alarms.filter(a => a.id !== id);
    setAlarms(updatedAlarms);
    localStorage.setItem(`${ALARM_KEY_PREFIX}${symbol}`, JSON.stringify(updatedAlarms));

    // Remove from global alarms
    const globalAlarms = JSON.parse(localStorage.getItem('order-position-alarms') || '[]');
    const updatedGlobalAlarms = globalAlarms.filter((a: any) => a.id !== id);
    localStorage.setItem('order-position-alarms', JSON.stringify(updatedGlobalAlarms));

    // Trigger custom event for immediate UI update
    window.dispatchEvent(new Event(`notes-updated-${symbol}`));
    window.dispatchEvent(new Event('alarms-updated'));

    toast({
      title: "Alarm silindi",
      variant: "destructive",
    });
  };

  const getNoteTypeColor = (type: TradingNote['type']) => {
    switch (type) {
      case 'BUY':
      case 'AL':
        return 'bg-order-green text-white';
      case 'SELL':
      case 'SAT':
        return 'bg-red-500 text-white';
      case 'HODL':
        return 'bg-blue-500 text-white';
      case 'TARİH':
        return 'bg-purple-500 text-white';
      default:
        return 'bg-muted';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl font-bold">{symbol}</span>
            <span className="text-sm text-muted-foreground">Trading Notları & Alarmlar</span>
          </DialogTitle>
          <DialogDescription>
            {symbol} için not ekleyin, destek/direnç alarmları tanımlayın.
          </DialogDescription>
          <div className="text-lg font-semibold text-order-green">
            Güncel Fiyat: ${currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
          </div>
        </DialogHeader>

        <Tabs defaultValue="notes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="notes">Notlar</TabsTrigger>
            <TabsTrigger value="alarms">Alarmlar</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="space-y-4">
            {/* Note Input */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div>
                <Label>Not Tipi</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {(['BUY', 'SELL', 'HODL', 'AL', 'SAT', 'TARİH'] as const).map((type) => (
                    <Button
                      key={type}
                      variant={noteType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNoteType(type)}
                      className={noteType === type ? getNoteTypeColor(type) : ''}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="note-content">Not (Opsiyonel)</Label>
                <Textarea
                  id="note-content"
                  placeholder="İsterseniz not ekleyebilirsiniz..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="note-price">Fiyat (Opsiyonel)</Label>
                <Input
                  id="note-price"
                  type="text"
                  placeholder="0.00"
                  value={notePrice}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d.]/g, '');
                    setNotePrice(val);
                  }}
                />
                {notePrice && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ${parseFloat(notePrice).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
                <div>
                  <Label htmlFor="note-date">Tarih (Opsiyonel)</Label>
                  <Input
                    id="note-date"
                    type="date"
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={saveNote} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Notu Kaydet
              </Button>
            </div>

            {/* Notes List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {notes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Henüz not eklenmemiş</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getNoteTypeColor(note.type)}>
                            {note.type}
                          </Badge>
                           {note.price && (
                            <span className="text-sm font-semibold text-order-green">
                              ${note.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                          {note.date && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(note.date).toLocaleDateString('tr-TR')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{note.content}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(note.createdAt).toLocaleString('tr-TR')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteNote(note.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="alarms" className="space-y-4">
            {/* Alarm Input */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div>
                <Label>Alarm Tipi</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button
                    variant={alarmType === 'destek' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAlarmType('destek')}
                    className={alarmType === 'destek' ? 'bg-order-green hover:bg-order-green/90' : ''}
                  >
                    <TrendingDown className="w-4 h-4 mr-2" />
                    Destek
                  </Button>
                  <Button
                    variant={alarmType === 'direnç' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAlarmType('direnç')}
                    className={alarmType === 'direnç' ? 'bg-red-500 hover:bg-red-600' : ''}
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Direnç
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="alarm-price">Hedef Fiyat</Label>
                <Input
                  id="alarm-price"
                  type="text"
                  placeholder="0.00"
                  value={alarmPrice}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d.]/g, '');
                    setAlarmPrice(val);
                  }}
                />
                {alarmPrice && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Hedef: ${parseFloat(alarmPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {alarmType === 'destek' 
                    ? `Fiyat ${alarmPrice ? parseFloat(alarmPrice).toLocaleString('tr-TR') : '...'} seviyesinin altına düştüğünde uyarı alacaksınız`
                    : `Fiyat ${alarmPrice ? parseFloat(alarmPrice).toLocaleString('tr-TR') : '...'} seviyesinin üstüne çıktığında uyarı alacaksınız`
                  }
                </p>
              </div>

              <Button onClick={addAlarm} className="w-full">
                <Bell className="w-4 h-4 mr-2" />
                Alarm Ekle
              </Button>
            </div>

            {/* Alarms List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {alarms.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Henüz alarm eklenmemiş</p>
              ) : (
                alarms.map((alarm) => (
                  <div 
                    key={alarm.id} 
                    className={`p-3 border rounded-lg ${alarm.triggered ? 'bg-order-green/10 border-order-green' : 'bg-card'} hover:bg-accent/50 transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {alarm.type === 'destek' ? (
                          <TrendingDown className="w-5 h-5 text-order-green" />
                        ) : (
                          <TrendingUp className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-semibold">
                            {alarm.type === 'destek' ? 'Destek' : 'Direnç'} - ${alarm.targetPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {alarm.condition === 'below' ? 'Altına düşünce' : 'Üstüne çıkınca'} uyarı
                          </p>
                          {alarm.triggered && (
                            <Badge className="mt-1 bg-order-green">Tetiklendi!</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAlarm(alarm.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
