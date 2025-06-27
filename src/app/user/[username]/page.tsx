'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { GuestbookEntry } from '@/components/guestbook-entry';
import { Navigation } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, User, EyeOff, Eye } from 'lucide-react';
import { getUserPosts } from '@/actions/guestbook';
import { getUserIdByUsername, getUserPreferences, updateIgnoredUsers } from '@/actions/preferences';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface GuestbookEntryType {
  id: string;
  message: string;
  createdAt: Date;
  username: string | null;
  displayUsername: string | null;
  name: string | null;
  userId: string;
  isCreator: boolean;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function UserPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const username = params.username as string;
  
  const [entries, setEntries] = useState<GuestbookEntryType[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch user preferences to check if user is ignored
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

  useEffect(() => {
    loadUserPosts(currentPage);
  }, [username, currentPage]);

  const loadUserPosts = async (page: number) => {
    try {
      setIsLoading(true);
      
      // First get the user ID by username
      const userId = await getUserIdByUsername(username);
      if (!userId) {
        router.push('/');
        return;
      }

      const data = await getUserPosts(userId, page, 50);
      setEntries(data.entries.map(entry => ({
        ...entry,
        createdAt: new Date(entry.createdAt),
      })));
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load user posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleIgnoreUser = async () => {
    const currentIgnored = preferences?.ignoredUsers || [];
    const isCurrentlyIgnored = currentIgnored.includes(username);
    
    let newIgnored: string[];
    if (isCurrentlyIgnored) {
      newIgnored = currentIgnored.filter(u => u !== username);
    } else {
      newIgnored = [...currentIgnored, username];
    }
    
    await updateIgnoredUsersMutation.mutateAsync(newIgnored);
  };

  const isUserIgnored = preferences?.ignoredUsers?.includes(username) || false;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-950 via-slate-950 to-teal-900">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%2314b8a6%22%20fill-opacity%3D%220.06%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        
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
        {/* Header */}
        <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/10 mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.back()}
              variant="ghost"
              className="hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center justify-between flex-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{username}</h1>
                  <p className="text-muted-foreground">
                    {pagination?.total || 0} message{pagination?.total === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              
              {/* CTA Buttons */}
              {session?.user?.emailVerified && (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleIgnoreUser}
                    disabled={updateIgnoredUsersMutation.isPending}
                    variant={isUserIgnored ? "outline" : "destructive"}
                    className={isUserIgnored 
                      ? "border-primary text-primary hover:bg-primary/10" 
                      : "bg-destructive hover:bg-destructive/90"
                    }
                  >
                    {updateIgnoredUsersMutation.isPending ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                    ) : isUserIgnored ? (
                      <Eye className="w-4 h-4 mr-2" />
                    ) : (
                      <EyeOff className="w-4 h-4 mr-2" />
                    )}
                    {isUserIgnored ? 'Unignore User' : 'Ignore User'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ignored User Notice */}
        {isUserIgnored && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-amber-500">
              <EyeOff className="w-5 h-5" />
              <p className="font-medium">You are currently ignoring this user</p>
            </div>
            <p className="text-amber-500/80 text-sm mt-1">
              Their messages won't appear in your filtered view on the main page.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-6">
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                {username} hasn't posted any messages yet.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4">
                {entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={entry.isCreator ?
                      'bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-500 p-[2px] rounded-2xl shadow-lg shadow-rose-500/40' : ''}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/10 transition-all hover:shadow-xl hover:shadow-primary/10 hover:scale-[1.02] hover:border-white/20">
                      <GuestbookEntry
                        id={entry.id}
                        message={entry.message}
                        username={entry.displayUsername || entry.username || entry.name}
                        createdAt={entry.createdAt}
                        isCreator={entry.isCreator}
                      />
                    </div>
                  </div>
                ))}
              </div>

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
            </>
          )}
        </div>
      </div>
    </div>
  );
}