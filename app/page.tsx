'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Phone,
  PhoneOff,
  Mic,
  Loader2,
  Menu,
  X,
  FileText,
  Upload,
  Trash2,
  Download,
  AlertCircle,
  Check,
  Settings as SettingsIcon,
  Search
} from 'lucide-react'
import {
  uploadAndTrainDocument,
  getDocuments,
  deleteDocuments,
  SUPPORTED_FILE_TYPES
} from '@/lib/ragKnowledgeBase'

// Theme colors — Heritage Premium
const THEME_VARS = {
  '--background': '35 29% 95%',
  '--foreground': '30 22% 14%',
  '--card': '35 29% 92%',
  '--card-foreground': '30 22% 14%',
  '--popover': '35 29% 90%',
  '--popover-foreground': '30 22% 14%',
  '--primary': '27 61% 26%',
  '--primary-foreground': '35 29% 98%',
  '--secondary': '35 20% 88%',
  '--secondary-foreground': '30 22% 18%',
  '--accent': '43 75% 38%',
  '--accent-foreground': '35 29% 98%',
  '--destructive': '0 84% 60%',
  '--destructive-foreground': '0 0% 98%',
  '--muted': '35 15% 85%',
  '--muted-foreground': '30 20% 45%',
  '--border': '27 61% 26%',
  '--input': '35 15% 75%',
  '--ring': '27 61% 26%',
  '--radius': '0.5rem'
} as React.CSSProperties

// CRITICAL: Use exact RAG ID from orchestrator
const RAG_ID = '698bdc1367a82d6d27bdde8c'
const VOICE_AGENT_ID = '698bdc2ef0601df65d51cb3b'

// TypeScript Interfaces
interface CallLog {
  id: string
  timestamp: string
  callerNumber: string
  duration: number
  outcome: 'completed' | 'missed' | 'transferred' | 'voicemail'
  transcript: string
  audioUrl?: string
}

interface Message {
  id: string
  callerName: string
  callerPhone: string
  timestamp: string
  content: string
  isUrgent: boolean
  isRead: boolean
  isFollowedUp: boolean
}

interface Appointment {
  id: string
  date: string
  time: string
  callerName: string
  callerPhone: string
  purpose: string
  status: 'scheduled' | 'confirmed' | 'cancelled'
}

interface VoiceSession {
  sessionId: string
  wsUrl: string
  audioConfig: {
    sampleRate: number
    channels: number
    encoding: string
  }
}

interface KnowledgeDocument {
  filename: string
  uploadedAt: string
  size: number
  status: string
}

// Mock Data Generator
function generateMockData() {
  const mockCalls: CallLog[] = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      callerNumber: '+1 (555) 123-4567',
      duration: 180,
      outcome: 'completed',
      transcript: 'Caller: Hi, I would like to schedule an appointment.\nReceptionist: Of course! What day works best for you?\nCaller: Tomorrow at 2 PM would be perfect.\nReceptionist: Great, I have you scheduled for tomorrow at 2 PM. May I have your name?\nCaller: John Smith.\nReceptionist: Perfect, John. Your appointment is confirmed.'
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      callerNumber: '+1 (555) 234-5678',
      duration: 90,
      outcome: 'transferred',
      transcript: 'Caller: I need to speak with billing.\nReceptionist: Let me transfer you to our billing department right away.'
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 10800000).toISOString(),
      callerNumber: '+1 (555) 345-6789',
      duration: 0,
      outcome: 'missed',
      transcript: ''
    }
  ]

  const mockMessages: Message[] = [
    {
      id: '1',
      callerName: 'Sarah Johnson',
      callerPhone: '+1 (555) 456-7890',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      content: 'Hi, I called earlier about getting pricing information for your services. Could someone call me back at their earliest convenience?',
      isUrgent: false,
      isRead: false,
      isFollowedUp: false
    },
    {
      id: '2',
      callerName: 'Michael Chen',
      callerPhone: '+1 (555) 567-8901',
      timestamp: new Date(Date.now() - 5400000).toISOString(),
      content: 'URGENT: I need to reschedule my appointment tomorrow. Please call me back ASAP.',
      isUrgent: true,
      isRead: false,
      isFollowedUp: false
    }
  ]

  const mockAppointments: Appointment[] = [
    {
      id: '1',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      time: '14:00',
      callerName: 'John Smith',
      callerPhone: '+1 (555) 123-4567',
      purpose: 'Consultation',
      status: 'confirmed'
    },
    {
      id: '2',
      date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
      time: '10:00',
      callerName: 'Emily Davis',
      callerPhone: '+1 (555) 678-9012',
      purpose: 'Follow-up appointment',
      status: 'scheduled'
    }
  ]

  return { mockCalls, mockMessages, mockAppointments }
}

// Voice Audio Helper Functions
function base64EncodeAudio(audioData: Float32Array): string {
  const pcm16 = new Int16Array(audioData.length)
  for (let i = 0; i < audioData.length; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]))
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  const bytes = new Uint8Array(pcm16.buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64DecodeAudio(base64: string): Int16Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Int16Array(bytes.buffer)
}

export default function Home() {
  // UI State
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'calls' | 'messages' | 'appointments' | 'settings'>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [useSampleData, setUseSampleData] = useState(false)

  // Voice State
  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [voiceSession, setVoiceSession] = useState<VoiceSession | null>(null)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [conversationHistory, setConversationHistory] = useState<Array<{speaker: string, text: string}>>([])
  const [callStatus, setCallStatus] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioQueueRef = useRef<Int16Array[]>([])
  const isPlayingRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  // Data State
  const [calls, setCalls] = useState<CallLog[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)
  const [messageFilter, setMessageFilter] = useState<'all' | 'unread' | 'followed-up'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Settings State
  const [businessName, setBusinessName] = useState('Heritage Medical Clinic')
  const [businessHours, setBusinessHours] = useState('Mon-Fri 9:00 AM - 5:00 PM')
  const [customGreeting, setCustomGreeting] = useState('Thank you for calling Heritage Medical Clinic. How may I assist you today?')
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [loadingDocs, setLoadingDocs] = useState(false)

  // Load sample data
  useEffect(() => {
    if (useSampleData) {
      const { mockCalls, mockMessages, mockAppointments } = generateMockData()
      setCalls(mockCalls)
      setMessages(mockMessages)
      setAppointments(mockAppointments)
    } else {
      setCalls([])
      setMessages([])
      setAppointments([])
    }
  }, [useSampleData])

  // Load knowledge base documents
  useEffect(() => {
    loadKnowledgeDocs()
  }, [])

  async function loadKnowledgeDocs() {
    setLoadingDocs(true)
    try {
      const docs = await getDocuments(RAG_ID)
      if (Array.isArray(docs)) {
        setKnowledgeDocs(docs.map((doc: any) => ({
          filename: doc?.filename ?? 'Unknown',
          uploadedAt: doc?.uploadedAt ?? new Date().toISOString(),
          size: doc?.size ?? 0,
          status: doc?.status ?? 'unknown'
        })))
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoadingDocs(false)
    }
  }

  async function handleDocumentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingDoc(true)
    setUploadMessage('')

    try {
      await uploadAndTrainDocument(RAG_ID, file)
      setUploadMessage(`✓ ${file.name} uploaded successfully`)
      await loadKnowledgeDocs()
    } catch (error) {
      setUploadMessage(`✗ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploadingDoc(false)
      e.target.value = ''
    }
  }

  async function handleDeleteDocument(filename: string) {
    try {
      await deleteDocuments(RAG_ID, [filename])
      setUploadMessage(`✓ ${filename} deleted`)
      await loadKnowledgeDocs()
    } catch (error) {
      setUploadMessage(`✗ Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Voice Session Management
  async function startVoiceCall() {
    setIsConnecting(true)
    setCallStatus('Connecting...')

    try {
      // Step 1: Start session via HTTP
      console.log('Starting voice session for agent:', VOICE_AGENT_ID)
      const res = await fetch('https://voice-sip.studio.lyzr.ai/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: VOICE_AGENT_ID })
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error('Session start failed:', res.status, errorText)
        throw new Error(`Session start failed: ${res.status}`)
      }

      const sessionData: VoiceSession = await res.json()
      console.log('Session started:', sessionData)
      setVoiceSession(sessionData)

      const sampleRate = sessionData?.audioConfig?.sampleRate ?? 24000

      // Step 2: Initialize AudioContext with session sample rate
      audioContextRef.current = new AudioContext({ sampleRate })

      // Step 3: Connect WebSocket using wsUrl from session
      console.log('Connecting to WebSocket:', sessionData.wsUrl)
      const ws = new WebSocket(sessionData.wsUrl)
      wsRef.current = ws

      ws.onopen = async () => {
        console.log('WebSocket connected')
        setCallStatus('Microphone access...')

        // Step 4: Start microphone capture
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true
            }
          })
          streamRef.current = stream
          console.log('Microphone access granted')

          if (!audioContextRef.current) return

          const source = audioContextRef.current.createMediaStreamSource(stream)
          const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1)
          processorRef.current = processor

          // Set active BEFORE connecting processor
          setIsCallActive(true)
          setIsConnecting(false)
          setCallStatus('Call active')
          setConversationHistory([])
          setCurrentTranscript('')

          processor.onaudioprocess = (e) => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

            const inputData = e.inputBuffer.getChannelData(0)
            const base64Audio = base64EncodeAudio(inputData)

            wsRef.current.send(JSON.stringify({
              type: 'audio',
              audio: base64Audio,
              sampleRate
            }))
          }

          source.connect(processor)
          processor.connect(audioContextRef.current.destination)
        } catch (micError) {
          throw new Error('Microphone access denied')
        }
      }

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data)
          console.log('WebSocket message received:', msg.type)

          if (msg.type === 'audio' && msg.audio) {
            // Queue audio for playback
            const pcm16 = base64DecodeAudio(msg.audio)
            audioQueueRef.current.push(pcm16)
            playNextAudio()
          } else if (msg.type === 'transcript') {
            console.log('Transcript:', msg.role, msg.text)
            if (msg.role === 'user') {
              setConversationHistory(prev => [...prev, { speaker: 'You', text: msg.text ?? '' }])
            } else if (msg.role === 'assistant') {
              setConversationHistory(prev => [...prev, { speaker: 'Receptionist', text: msg.text ?? '' }])
            }
            setCurrentTranscript('')
          } else if (msg.type === 'thinking') {
            setCurrentTranscript('Receptionist is thinking...')
          } else if (msg.type === 'clear') {
            setCurrentTranscript('')
          } else if (msg.type === 'error') {
            console.error('Voice error:', msg.message)
            setCallStatus(`Error: ${msg.message ?? 'Unknown error'}`)
          }
        } catch (parseError) {
          console.error('Message parse error:', parseError, event.data)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setCallStatus('Connection error')
        endVoiceCall()
      }

      ws.onclose = () => {
        console.log('WebSocket closed')
        if (isCallActive) {
          setCallStatus('Call ended')
          endVoiceCall()
        }
      }

    } catch (error) {
      console.error('Voice call error:', error)
      setCallStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsConnecting(false)
      endVoiceCall()
    }
  }

  function playNextAudio() {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current) return

    isPlayingRef.current = true
    const pcm16 = audioQueueRef.current.shift()!
    const sampleRate = voiceSession?.audioConfig?.sampleRate ?? 24000

    const audioBuffer = audioContextRef.current.createBuffer(1, pcm16.length, sampleRate)
    const channelData = audioBuffer.getChannelData(0)

    for (let i = 0; i < pcm16.length; i++) {
      channelData[i] = pcm16[i] / 32768.0
    }

    const source = audioContextRef.current.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContextRef.current.destination)
    source.onended = () => {
      isPlayingRef.current = false
      playNextAudio()
    }
    source.start()
  }

  function endVoiceCall() {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Stop microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Disconnect audio processor
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    audioQueueRef.current = []
    isPlayingRef.current = false
    setIsCallActive(false)
    setIsConnecting(false)
    setCallStatus('')
    setCurrentTranscript('')
  }

  // Message Actions
  function toggleMessageRead(id: string) {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, isRead: !msg.isRead } : msg
    ))
  }

  function toggleMessageFollowUp(id: string) {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, isFollowedUp: !msg.isFollowedUp } : msg
    ))
  }

  function deleteMessage(id: string) {
    setMessages(prev => prev.filter(msg => msg.id !== id))
  }

  // Filtered Messages
  const filteredMessages = messages.filter(msg => {
    if (messageFilter === 'unread') return !msg.isRead
    if (messageFilter === 'followed-up') return msg.isFollowedUp
    return true
  })

  // Stats Calculations
  const todaysCalls = calls.filter(call => {
    const callDate = new Date(call.timestamp).toDateString()
    const today = new Date().toDateString()
    return callDate === today
  }).length

  const todaysMessages = messages.filter(msg => {
    const msgDate = new Date(msg.timestamp).toDateString()
    const today = new Date().toDateString()
    return msgDate === today
  }).length

  const todaysAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.date).toDateString()
    const today = new Date().toDateString()
    return aptDate === today
  }).length

  const avgCallDuration = calls.length > 0
    ? Math.round(calls.reduce((sum, call) => sum + call.duration, 0) / calls.length)
    : 0

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div style={THEME_VARS} className="min-h-screen bg-background text-foreground font-sans tracking-wide leading-relaxed">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-serif font-bold tracking-wide">
              {businessName}
            </h1>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isCallActive ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
              <span className="text-sm text-muted-foreground">
                {isCallActive ? 'Active Call' : 'Standby'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="sample-data" className="text-sm font-medium">
                Sample Data
              </Label>
              <Switch
                id="sample-data"
                checked={useSampleData}
                onCheckedChange={setUseSampleData}
              />
            </div>

            {!isCallActive && !isConnecting && (
              <Button
                onClick={startVoiceCall}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                <Phone className="h-4 w-4 mr-2" />
                Start Test Call
              </Button>
            )}

            {isConnecting && (
              <Button disabled className="bg-muted">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </Button>
            )}

            {isCallActive && (
              <Button
                onClick={endVoiceCall}
                variant="destructive"
                className="font-semibold"
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                End Call
              </Button>
            )}
          </div>
        </div>

        {/* Call Status Bar */}
        {(isCallActive || isConnecting) && (
          <div className="bg-accent/10 px-6 py-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mic className="h-5 w-5 text-accent animate-pulse" />
                <span className="text-sm font-medium">{callStatus}</span>
              </div>
              {currentTranscript && (
                <span className="text-sm text-muted-foreground italic">{currentTranscript}</span>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden bg-card border-r border-border`}>
          <ScrollArea className="h-[calc(100vh-88px)]">
            <nav className="p-4 space-y-2">
              <Button
                variant={currentScreen === 'dashboard' ? 'default' : 'ghost'}
                className="w-full justify-start font-medium"
                onClick={() => setCurrentScreen('dashboard')}
              >
                Dashboard
              </Button>
              <Button
                variant={currentScreen === 'calls' ? 'default' : 'ghost'}
                className="w-full justify-start font-medium"
                onClick={() => setCurrentScreen('calls')}
              >
                Call Logs
                {calls.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {calls.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant={currentScreen === 'messages' ? 'default' : 'ghost'}
                className="w-full justify-start font-medium"
                onClick={() => setCurrentScreen('messages')}
              >
                Messages
                {messages.filter(m => !m.isRead).length > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {messages.filter(m => !m.isRead).length}
                  </Badge>
                )}
              </Button>
              <Button
                variant={currentScreen === 'appointments' ? 'default' : 'ghost'}
                className="w-full justify-start font-medium"
                onClick={() => setCurrentScreen('appointments')}
              >
                Appointments
                {appointments.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {appointments.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant={currentScreen === 'settings' ? 'default' : 'ghost'}
                className="w-full justify-start font-medium"
                onClick={() => setCurrentScreen('settings')}
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </nav>

            {/* Live Conversation */}
            {isCallActive && conversationHistory.length > 0 && (
              <div className="p-4 border-t border-border">
                <h3 className="text-sm font-serif font-semibold mb-3">Live Conversation</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {conversationHistory.map((entry, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-semibold text-accent">{entry.speaker}:</span>
                      <p className="text-muted-foreground mt-1">{entry.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto">
            {/* DASHBOARD */}
            {currentScreen === 'dashboard' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-serif font-bold tracking-wide">Dashboard</h2>
                </div>

                {!useSampleData && calls.length === 0 && (
                  <Card className="bg-muted/30 border-border">
                    <CardContent className="py-8 text-center">
                      <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Your AI receptionist is ready. Enable Sample Data to see how call logs, messages, and appointments appear.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs tracking-wide">Today's Calls</CardDescription>
                      <CardTitle className="text-3xl font-serif font-bold text-primary">{todaysCalls}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs tracking-wide">Messages Taken</CardDescription>
                      <CardTitle className="text-3xl font-serif font-bold text-accent">{todaysMessages}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs tracking-wide">Appointments</CardDescription>
                      <CardTitle className="text-3xl font-serif font-bold text-secondary-foreground">{todaysAppointments}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs tracking-wide">Avg Call Duration</CardDescription>
                      <CardTitle className="text-3xl font-serif font-bold text-muted-foreground">{formatDuration(avgCallDuration)}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {/* Recent Calls */}
                {calls.length > 0 && (
                  <Card className="bg-card border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="font-serif tracking-wide">Recent Calls</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {calls.slice(0, 5).map(call => (
                          <div key={call.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{call.callerNumber}</span>
                                <Badge variant={
                                  call.outcome === 'completed' ? 'default' :
                                  call.outcome === 'transferred' ? 'secondary' :
                                  call.outcome === 'missed' ? 'destructive' : 'outline'
                                } className="text-xs">
                                  {call.outcome}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{formatTimestamp(call.timestamp)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{formatDuration(call.duration)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Pending Messages */}
                {messages.filter(m => !m.isRead).length > 0 && (
                  <Card className="bg-card border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="font-serif tracking-wide">Pending Messages</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {messages.filter(m => !m.isRead).slice(0, 3).map(msg => (
                          <div key={msg.id} className="p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-sm">{msg.callerName}</p>
                                <p className="text-xs text-muted-foreground">{msg.callerPhone}</p>
                              </div>
                              {msg.isUrgent && (
                                <Badge variant="destructive" className="text-xs">URGENT</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{msg.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">{formatTimestamp(msg.timestamp)}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* CALL LOGS */}
            {currentScreen === 'calls' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-serif font-bold tracking-wide">Call Logs</h2>
                  <Button variant="outline" className="border-border">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                {calls.length === 0 && (
                  <Card className="bg-muted/30 border-border">
                    <CardContent className="py-12 text-center">
                      <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No call logs yet. Enable Sample Data to see example call records.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {calls.length > 0 && (
                  <Card className="bg-card border-border shadow-sm">
                    <CardContent className="p-0">
                      <div className="divide-y divide-border">
                        {calls.map(call => (
                          <div key={call.id}>
                            <div
                              className="p-4 hover:bg-muted/20 cursor-pointer transition-colors"
                              onClick={() => setExpandedCallId(expandedCallId === call.id ? null : call.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold">{call.callerNumber}</span>
                                    <Badge variant={
                                      call.outcome === 'completed' ? 'default' :
                                      call.outcome === 'transferred' ? 'secondary' :
                                      call.outcome === 'missed' ? 'destructive' : 'outline'
                                    }>
                                      {call.outcome}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>{formatTimestamp(call.timestamp)}</span>
                                    <span>Duration: {formatDuration(call.duration)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {expandedCallId === call.id && call.transcript && (
                              <div className="px-4 pb-4 bg-muted/10">
                                <Separator className="mb-4" />
                                <h4 className="text-sm font-semibold mb-2">Transcript</h4>
                                <div className="bg-background p-3 rounded-lg text-sm whitespace-pre-wrap font-mono text-xs">
                                  {call.transcript}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* MESSAGES */}
            {currentScreen === 'messages' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-serif font-bold tracking-wide">Messages</h2>
                  <div className="flex gap-2">
                    <Button
                      variant={messageFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMessageFilter('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={messageFilter === 'unread' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMessageFilter('unread')}
                    >
                      Unread
                    </Button>
                    <Button
                      variant={messageFilter === 'followed-up' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMessageFilter('followed-up')}
                    >
                      Followed Up
                    </Button>
                  </div>
                </div>

                {filteredMessages.length === 0 && (
                  <Card className="bg-muted/30 border-border">
                    <CardContent className="py-12 text-center">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        {messageFilter === 'all'
                          ? 'No messages yet. Enable Sample Data to see example messages.'
                          : `No ${messageFilter} messages.`
                        }
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-4">
                  {filteredMessages.map(msg => (
                    <Card key={msg.id} className={`bg-card border-border shadow-sm ${!msg.isRead ? 'ring-2 ring-accent/20' : ''}`}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-serif font-semibold text-lg">{msg.callerName}</h3>
                              {!msg.isRead && (
                                <Badge variant="default" className="text-xs">New</Badge>
                              )}
                              {msg.isUrgent && (
                                <Badge variant="destructive" className="text-xs">URGENT</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{msg.callerPhone}</p>
                            <p className="text-xs text-muted-foreground mt-1">{formatTimestamp(msg.timestamp)}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant={msg.isRead ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => toggleMessageRead(msg.id)}
                            >
                              {msg.isRead ? 'Mark Unread' : 'Mark Read'}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => deleteMessage(msg.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <p className="text-sm mb-4 bg-muted/30 p-3 rounded-lg">{msg.content}</p>

                        <div className="flex items-center gap-2">
                          <Switch
                            id={`follow-up-${msg.id}`}
                            checked={msg.isFollowedUp}
                            onCheckedChange={() => toggleMessageFollowUp(msg.id)}
                          />
                          <Label htmlFor={`follow-up-${msg.id}`} className="text-sm">
                            Mark as followed up
                          </Label>
                          {msg.isFollowedUp && (
                            <Check className="h-4 w-4 text-green-600 ml-2" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* APPOINTMENTS */}
            {currentScreen === 'appointments' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-serif font-bold tracking-wide">Appointments</h2>

                {appointments.length === 0 && (
                  <Card className="bg-muted/30 border-border">
                    <CardContent className="py-12 text-center">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No scheduled appointments. Enable Sample Data to see example appointments.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {appointments.map(apt => (
                    <Card key={apt.id} className="bg-card border-border shadow-sm">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="font-serif text-lg">{apt.callerName}</CardTitle>
                            <CardDescription className="text-xs mt-1">{apt.callerPhone}</CardDescription>
                          </div>
                          <Badge variant={
                            apt.status === 'confirmed' ? 'default' :
                            apt.status === 'scheduled' ? 'secondary' : 'outline'
                          } className="text-xs">
                            {apt.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Date:</span>
                            <span className="font-medium">{new Date(apt.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Time:</span>
                            <span className="font-medium">{apt.time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Purpose:</span>
                            <span className="font-medium">{apt.purpose}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* SETTINGS */}
            {currentScreen === 'settings' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-serif font-bold tracking-wide">Settings</h2>

                {/* Business Information */}
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="font-serif tracking-wide">Business Information</CardTitle>
                    <CardDescription className="text-xs">Configure your business details for the receptionist</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="business-name" className="text-sm font-medium">Business Name</Label>
                      <Input
                        id="business-name"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="mt-1.5 bg-input border-border"
                      />
                    </div>
                    <div>
                      <Label htmlFor="business-hours" className="text-sm font-medium">Business Hours</Label>
                      <Input
                        id="business-hours"
                        value={businessHours}
                        onChange={(e) => setBusinessHours(e.target.value)}
                        className="mt-1.5 bg-input border-border"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Greeting Customization */}
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="font-serif tracking-wide">Greeting Message</CardTitle>
                    <CardDescription className="text-xs">Customize how your AI receptionist greets callers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={customGreeting}
                      onChange={(e) => setCustomGreeting(e.target.value)}
                      rows={3}
                      className="bg-input border-border"
                    />
                  </CardContent>
                </Card>

                {/* Knowledge Base */}
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="font-serif tracking-wide">Knowledge Base</CardTitle>
                    <CardDescription className="text-xs">
                      Upload documents (FAQs, services, pricing) to train your receptionist
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="doc-upload" className="text-sm font-medium mb-2 block">
                        Upload Document
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="doc-upload"
                          type="file"
                          accept={SUPPORTED_FILE_TYPES.join(',')}
                          onChange={handleDocumentUpload}
                          disabled={uploadingDoc}
                          className="bg-input border-border"
                        />
                        {uploadingDoc && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Supported: PDF, DOC, DOCX, TXT, MD
                      </p>
                    </div>

                    {uploadMessage && (
                      <div className={`p-3 rounded-lg text-sm ${uploadMessage.startsWith('✓') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {uploadMessage}
                      </div>
                    )}

                    <Separator />

                    <div>
                      <h4 className="text-sm font-semibold mb-3">Uploaded Documents</h4>
                      {loadingDocs && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading documents...
                        </div>
                      )}

                      {!loadingDocs && knowledgeDocs.length === 0 && (
                        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                      )}

                      {!loadingDocs && knowledgeDocs.length > 0 && (
                        <div className="space-y-2">
                          {knowledgeDocs.map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                              <div className="flex items-center gap-3">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{doc.filename}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(doc.uploadedAt).toLocaleDateString()} • {(doc.size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteDocument(doc.filename)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Agent Info */}
                <Card className="bg-muted/30 border-border">
                  <CardHeader>
                    <CardTitle className="font-serif tracking-wide text-sm">Agent Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Voice Agent ID:</span>
                        <code className="bg-background px-2 py-1 rounded font-mono">{VOICE_AGENT_ID}</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Knowledge Base ID:</span>
                        <code className="bg-background px-2 py-1 rounded font-mono">{RAG_ID}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${isCallActive ? 'bg-green-500' : 'bg-muted'}`} />
                        <span className="text-muted-foreground">
                          Status: {isCallActive ? 'Active' : 'Standby'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
