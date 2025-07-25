'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { authClient } from '@/lib/auth-client';
import { GuestbookEntry } from '@/components/guestbook-entry';
import { NewMessageForm } from '@/components/new-message-form';
import { Navigation } from '@/components/navigation';
import { getGuestbookEntries, createGuestbookEntry } from '@/actions/guestbook';
import { getUserPreferences, updateIgnoredUsers } from '@/actions/preferences';
import { Button } from '@/components/ui/button';
import { MessageSquare, KeyRound, RefreshCw, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AuthForm } from '@/components/auth-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';


export default function Home() {
  const router = useRouter();
  const { data: session, isPending, refetch: refetchSession } = useSession();
  const queryClient = useQueryClient();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpSentDuringSignup, setOtpSentDuringSignup] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [lastOtpSentTime, setLastOtpSentTime] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showIgnored, setShowIgnored] = useState(false);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Fetch guestbook entries with pagination
  const { data: guestbookData, isLoading } = useQuery({
    queryKey: ['guestbook', currentPage],
    queryFn: async () => {
      const data = await getGuestbookEntries(currentPage, 50);
      return {
        entries: data.entries.map(entry => ({
          ...entry,
          createdAt: new Date(entry.createdAt),
        })),
        pagination: data.pagination,
      };
    },
    enabled: true,
  });

  // Fetch user preferences
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: getUserPreferences,
    enabled: !!session?.user?.emailVerified,
  });

  // Mutation for updating ignored users
  const updateIgnoredUsersMutation = useMutation({
    mutationFn: updateIgnoredUsers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    },
  });

  // Mutation for creating new messages
  const createMessageMutation = useMutation({
    mutationFn: ({ message, replyToId }: { message: string; replyToId?: string }) => 
      createGuestbookEntry(message, replyToId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guestbook'] });
    },
    onError: (error) => {
      // If error is about email verification, show the OTP input
      if (error.message.includes('verify your email')) {
        setShowOtpInput(true);
      }
    },
  });

  // Check if user just signed up and needs verification
  useEffect(() => {
    if (session && !session.user.emailVerified) {
      setOtpSentDuringSignup(true);
      setShowOtpInput(true);
      // Set initial cooldown since OTP was just sent during signup
      if (!lastOtpSentTime) {
        setLastOtpSentTime(Date.now());
        setResendCooldown(RESEND_COOLDOWN_MINUTES * 60);
      }
    }
  }, [session, lastOtpSentTime]);

  // Handle window focus to refresh session when user comes back from email
  useEffect(() => {
    const handleFocus = async () => {
      if (session && !session.user.emailVerified) {
        await refetchSession();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [session, refetchSession]);

  // Update resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            setOtpError(''); // Clear error when cooldown expires
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  const handleNewMessage = async (message: string) => {
    await createMessageMutation.mutateAsync({ message });
  };

  const handleReply = async (messageId: string, replyText: string) => {
    await createMessageMutation.mutateAsync({ message: replyText, replyToId: messageId });
  };

  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a brief highlight effect
      element.classList.add('ring-2', 'ring-primary/50');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary/50');
      }, 2000);
    }
  };

  const RESEND_COOLDOWN_MINUTES = 2; // Cooldown period in minutes

  const handleResendOtp = async () => {
    if (!session?.user.email) return;
    
    // Check if still in cooldown period
    if (lastOtpSentTime) {
      const timeSinceLastSend = Date.now() - lastOtpSentTime;
      const cooldownMs = RESEND_COOLDOWN_MINUTES * 60 * 1000;
      
      if (timeSinceLastSend < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
        setOtpError(`Please wait ${Math.ceil(remainingSeconds / 60)} minute${Math.ceil(remainingSeconds / 60) > 1 ? 's' : ''} before resending`);
        return;
      }
    }
    
    setOtpLoading(true);
    setOtpError('');
    
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email: session.user.email,
        type: 'email-verification',
      });
      setShowOtpInput(true);
      setOtpSentDuringSignup(false); // Mark as manually sent
      setLastOtpSentTime(Date.now());
      setResendCooldown(RESEND_COOLDOWN_MINUTES * 60); // Set cooldown in seconds
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!session?.user.email || !otp.trim()) return;
    
    setOtpLoading(true);
    setOtpError('');
    
    try {
      await authClient.emailOtp.verifyEmail({
        email: session.user.email,
        otp: otp.trim(),
      });
      setOtp('');
      setShowOtpInput(false);
      setOtpSentDuringSignup(false);
      
      // Refetch session to get updated emailVerified status
      await refetchSession();
      
      // Invalidate and refetch all queries to ensure fresh data
      queryClient.invalidateQueries();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleUsernameAction = async (username: string, action: 'ignore' | 'view-only') => {
    if (!session) {
      setShowAuthModal(true);
      return;
    }

    if (action === 'ignore') {
      const currentIgnored = preferences?.ignoredUsers || [];
      const isCurrentlyIgnored = currentIgnored.includes(username);
      
      let newIgnored: string[];
      if (isCurrentlyIgnored) {
        newIgnored = currentIgnored.filter(u => u !== username);
      } else {
        newIgnored = [...currentIgnored, username];
      }
      
      await updateIgnoredUsersMutation.mutateAsync(newIgnored);
    } else if (action === 'view-only') {
      router.push(`/user/${username}`);
    }
  };

  const entries = guestbookData?.entries || [];
  const pagination = guestbookData?.pagination;
  const ignoredUsers = preferences?.ignoredUsers || [];

  const filteredEntries = showIgnored 
    ? entries 
    : entries.filter(entry => {
        const username = entry.displayUsername || entry.username || entry.name;
        return !username || !ignoredUsers.includes(username);
      });

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  if (isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-950 via-slate-950 to-teal-900">
        <Navigation />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-pulse">
            <div className="h-2 w-2 bg-primary rounded-full mx-1 inline-block animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="h-2 w-2 bg-primary rounded-full mx-1 inline-block animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="h-2 w-2 bg-primary rounded-full mx-1 inline-block animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-950 via-slate-950 to-teal-900">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%2314b8a6%22%20fill-opacity%3D%220.06%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30"></div>
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
      
      <Navigation />
      
      <div className="relative max-w-4xl mx-auto px-4 py-8">

        {session && (
          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/10 mb-8 hidden sm:block">
            {session.user.emailVerified ? (
              <NewMessageForm onSubmit={handleNewMessage} />
            ) : (
              <div className="space-y-6">
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
                    <MessageSquare className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-foreground font-medium mb-1">Please verify your email</p>
                    <p className="text-muted-foreground text-sm">
                      {showOtpInput 
                        ? (otpSentDuringSignup 
                          ? 'We sent a verification code to your email during signup'
                          : 'Enter the verification code from your email')
                        : 'Verify your email address to start posting messages'
                      }
                    </p>
                  </div>
                </div>

                {otpError && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
                    {otpError}
                  </div>
                )}

                {showOtpInput ? (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter 6-digit code"
                        className="flex-1 px-4 py-3 bg-white/10 border border-input rounded-lg shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-foreground text-center text-lg tracking-widest"
                        maxLength={6}
                        disabled={otpLoading}
                      />
                      <Button
                        onClick={handleVerifyOtp}
                        disabled={!otp.trim() || otpLoading}
                        className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                      >
                        {otpLoading ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        ) : (
                          <KeyRound className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <div className="text-center">
                      <button
                        onClick={handleResendOtp}
                        disabled={otpLoading || resendCooldown > 0}
                        className="text-sm text-primary hover:text-primary/80 underline disabled:opacity-50"
                      >
                        {resendCooldown > 0 
                          ? `Resend code in ${Math.ceil(resendCooldown / 60)}:${String(resendCooldown % 60).padStart(2, '0')}`
                          : (otpSentDuringSignup ? "Didn't receive it? Resend code" : "Resend code")
                        }
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Button
                      onClick={handleResendOtp}
                      disabled={otpLoading || resendCooldown > 0}
                      variant="outline"
                      className="border-primary/20 hover:bg-primary/10"
                    >
                      {otpLoading ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary mr-2" />
                          Sending...
                        </>
                      ) : resendCooldown > 0 ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Resend in {Math.ceil(resendCooldown / 60)}:{String(resendCooldown % 60).padStart(2, '0')}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Send verification code
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          
          {/* Filter Controls */}
          {ignoredUsers.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowIgnored(!showIgnored)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    showIgnored
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20'
                      : 'border-primary/20 text-primary hover:bg-primary/10'
                  }`}
                >
                  {showIgnored ? 'Hide' : 'Show'} ignored users
                </button>
                <div className="text-sm text-muted-foreground">
                  {ignoredUsers.length} user{ignoredUsers.length === 1 ? '' : 's'} ignored
                </div>
              </div>
            </div>
          )}
          
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-pulse">
                <div className="h-2 w-2 bg-primary rounded-full mx-1 inline-block animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="h-2 w-2 bg-primary rounded-full mx-1 inline-block animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="h-2 w-2 bg-primary rounded-full mx-1 inline-block animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                No messages yet. Be the first to leave one!
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  id={`message-${entry.id}`}
                  className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/10 transition-all hover:shadow-xl hover:shadow-primary/10 hover:scale-[1.02] hover:border-white/20"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <GuestbookEntry
                    id={entry.id}
                    message={entry.message}
                    username={entry.displayUsername || entry.username || entry.name}
                    createdAt={entry.createdAt}
                    onUsernameAction={handleUsernameAction}
                    isUserIgnored={ignoredUsers.includes(entry.displayUsername || entry.username || entry.name || '')}
                    onReply={session?.user?.emailVerified ? handleReply : undefined}
                    onScrollToMessage={handleScrollToMessage}
                    isReply={!!entry.replyToId}
                    replyToUsername={'replyToUsername' in entry ? entry.replyToUsername : undefined}
                    replyToMessageId={entry.replyToId || undefined}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!pagination.hasPrev}
                  variant="outline"
                  className="border-primary/20 hover:bg-primary/10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(page => 
                      page === 1 || 
                      page === pagination.totalPages || 
                      Math.abs(page - currentPage) <= 1
                    )
                    .map((page, index, visiblePages) => (
                      <div key={page} className="flex items-center">
                        {index > 0 && visiblePages[index - 1] !== page - 1 && (
                          <span className="text-muted-foreground px-2">...</span>
                        )}
                        <Button
                          onClick={() => handlePageChange(page)}
                          variant={page === currentPage ? "default" : "ghost"}
                          className={page === currentPage ? "bg-primary text-primary-foreground" : "hover:bg-white/5"}
                        >
                          {page}
                        </Button>
                      </div>
                    ))}
                </div>
                
                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination.hasNext}
                  variant="outline"
                  className="border-primary/20 hover:bg-primary/10"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
        </div>
      </div>

      <Dialog open={showNewMessageModal} onOpenChange={setShowNewMessageModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave a new message</DialogTitle>
          </DialogHeader>
          <NewMessageForm onSubmit={async (message) => {
            await handleNewMessage(message);
            setShowNewMessageModal(false);
          }} />
        </DialogContent>
      </Dialog>

      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">Sign in to ignore users</DialogTitle>
          </DialogHeader>
          <AuthForm onSuccess={() => {
            setShowAuthModal(false);
            refetchSession();
          }} />
        </DialogContent>
      </Dialog>

      {session?.user?.emailVerified && (
        <Button
          onClick={() => setShowNewMessageModal(true)}
          className="sm:hidden fixed bottom-4 right-4 h-16 w-16 rounded-full bg-primary shadow-lg flex items-center justify-center"
        >
          <Plus className="h-8 w-8" />
        </Button>
      )}
    </div>
  );
}