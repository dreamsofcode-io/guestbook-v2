'use client';

import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Reply, Send, X, Quote, Sparkles } from 'lucide-react';

interface GuestbookEntryProps {
  id: string;
  message: string;
  username: string | null;
  createdAt: Date;
  onUsernameAction?: (username: string, action: 'ignore' | 'view-only') => void;
  isUserIgnored?: boolean;
  onReply?: (messageId: string, replyText: string) => void;
  isReply?: boolean;
  replyToUsername?: string | null;
  replyToMessage?: string;
  replyToMessageId?: string;
  onScrollToMessage?: (messageId: string) => void;
  isCreator?: boolean;
}

export function GuestbookEntry({ 
  id, 
  message, 
  username, 
  createdAt, 
  onUsernameAction, 
  isUserIgnored, 
  onReply,
  isReply = false,
  replyToUsername,
  replyToMessage,
  replyToMessageId,
  onScrollToMessage,
  isCreator = false
}: GuestbookEntryProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !onReply) return;

    setIsSubmitting(true);
    try {
      await onReply(id, replyText.trim());
      setReplyText('');
      setShowReplyForm(false);
    } catch (error) {
      console.error('Failed to submit reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`space-y-3 ${isReply ? 'ml-6 border-l-2 border-primary/20 pl-4' : ''}`}>
      {isReply && replyToUsername && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Quote className="w-3 h-3 text-primary" />
          <span>Replying to</span>
          <button 
            className="text-primary font-medium hover:text-primary/80 transition-colors"
            onClick={() => replyToMessageId && onScrollToMessage?.(replyToMessageId)}
            title="Click to view original message"
          >
            {replyToUsername}
          </button>
        </div>
      )}

      <p className="text-foreground leading-relaxed whitespace-pre-wrap text-lg">
        {message}
      </p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {username ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={
                  `font-medium hover:text-primary/80 transition-colors ${isCreator ? 'text-transparent bg-gradient-to-r from-fuchsia-400 via-rose-400 to-orange-400 bg-clip-text' : 'text-primary'}`
                }>
                  {username}
                  {isCreator && <Sparkles className="w-3 h-3 inline ml-1" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => window.location.href = `/user/${username}`}
                  className="flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View {username}'s profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onUsernameAction?.(username, 'ignore')}
                  className="flex items-center gap-2"
                >
                  <EyeOff className="w-4 h-4" />
                  {isUserIgnored ? 'Unignore' : 'Ignore'} {username}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="font-medium text-primary">Anonymous</span>
          )}
          <span className="text-muted-foreground">•</span>
          <time dateTime={createdAt.toISOString()} className="text-muted-foreground">
            {createdAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>
        
        {onReply && (
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded flex items-center gap-1 opacity-70 hover:opacity-100"
          >
            <Reply className="w-3 h-3" />
            Reply
          </button>
        )}
      </div>

      {showReplyForm && (
        <form onSubmit={handleReplySubmit} className="mt-4 space-y-3">
          <div className="flex gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${username}...`}
              className="flex-1 min-h-[80px] px-3 py-2 bg-white/10 border border-input rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-foreground resize-none"
              disabled={isSubmitting}
              maxLength={1000}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {replyText.length}/1000 characters
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyText('');
                }}
                disabled={isSubmitting}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!replyText.trim() || isSubmitting}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white mr-1" />
                    Replying...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    Reply
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}