// Chat Group Actions Dialog

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateChat,
  useJoinGroup,
  useMutualFollows,
} from '@/lib/features/chat/use-chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type InviteMode = 'open' | 'approval' | 'admin_only';

const inviteModeOptions: Array<{ value: InviteMode; label: string; description: string }> = [
  {
    value: 'open',
    label: 'Terbuka',
    description: 'Siapa pun dengan kode undangan bisa langsung masuk.',
  },
  {
    value: 'approval',
    label: 'Perlu Persetujuan',
    description: 'Setiap request join harus disetujui admin.',
  },
  {
    value: 'admin_only',
    label: 'Admin Saja',
    description: 'Hanya admin yang bisa menambahkan anggota.',
  },
];

interface ChatGroupActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(name?: string | null) {
  return (
    name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'US'
  );
}

export function ChatGroupActionsDialog({ open, onOpenChange }: ChatGroupActionsDialogProps) {
  const router = useRouter();
  const { data: mutualFollows = [], isLoading: isLoadingMutuals } = useMutualFollows();
  const { mutateAsync: createChat, isPending: isCreatingGroup } = useCreateChat();
  const { mutateAsync: joinGroup, isPending: isJoiningGroup } = useJoinGroup();

  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('');
  const [inviteMode, setInviteMode] = useState<InviteMode>('open');
  const [allowMemberInvite, setAllowMemberInvite] = useState(true);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [inviteCode, setInviteCode] = useState('');

  const resetState = () => {
    setTab('create');
    setGroupName('');
    setInviteMode('open');
    setAllowMemberInvite(true);
    setSelectedMemberIds([]);
    setInviteCode('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  };

  const toggleMemberSelection = (userId: string) => {
    setSelectedMemberIds((previous) => {
      if (previous.includes(userId)) {
        return previous.filter((id) => id !== userId);
      }
      return [...previous, userId];
    });
  };

  const handleCreateGroup = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedName = groupName.trim();
    if (normalizedName.length < 3) {
      toast.error('Nama grup minimal 3 karakter');
      return;
    }

    const chat = await createChat({
      groupName: normalizedName,
      memberIds: selectedMemberIds,
      inviteMode,
      allowMemberInvite,
    });

    handleOpenChange(false);
    router.push(`/chat/${chat.id}`);
  };

  const handleJoinGroup = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedCode = inviteCode.trim();
    if (!normalizedCode) {
      toast.error('Masukkan kode undangan terlebih dahulu');
      return;
    }

    const chat = await joinGroup(normalizedCode);
    if (!chat?.id) {
      toast.error('Grup tidak ditemukan');
      return;
    }

    handleOpenChange(false);
    router.push(`/chat/${chat.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-border/70 bg-card p-0">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle>Aksi Grup</DialogTitle>
          <DialogDescription>
            Buat grup baru atau gabung ke grup dengan kode undangan.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4">
          <Tabs value={tab} onValueChange={(value) => setTab(value as 'create' | 'join')}>
            <TabsList className="grid h-10 w-full grid-cols-2">
              <TabsTrigger value="create" className="gap-2">
                <Plus className="h-4 w-4" />
                Buat Grup
              </TabsTrigger>
              <TabsTrigger value="join" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Gabung Grup
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-4 space-y-4">
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="group-name" className="text-sm font-medium">
                    Nama Grup
                  </label>
                  <Input
                    id="group-name"
                    placeholder="Contoh: Komunitas OMK Katedral"
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    disabled={isCreatingGroup}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Mode Undangan</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {inviteModeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                          inviteMode === option.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border/70 hover:bg-muted/40'
                        }`}
                        onClick={() => setInviteMode(option.value)}
                        disabled={isCreatingGroup}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Izinkan member mengundang orang lain</p>
                    <p className="text-xs text-muted-foreground">
                      Jika mati, hanya admin yang bisa menambah member.
                    </p>
                  </div>
                  <Switch
                    checked={allowMemberInvite}
                    onCheckedChange={setAllowMemberInvite}
                    disabled={isCreatingGroup}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Tambah Member Awal (Opsional)</p>
                    <p className="text-xs text-muted-foreground">
                      Dipilih: {selectedMemberIds.length}
                    </p>
                  </div>
                  <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-border/70 p-2">
                    {isLoadingMutuals ? (
                      <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat relasi...
                      </div>
                    ) : mutualFollows.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        Belum ada mutual follow untuk ditambahkan.
                      </div>
                    ) : (
                      mutualFollows.map((profile) => {
                        const selected = selectedMemberIds.includes(profile.id);
                        return (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => toggleMemberSelection(profile.id)}
                            disabled={isCreatingGroup}
                            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                              selected
                                ? 'border-primary bg-primary/5'
                                : 'border-border/60 hover:bg-muted/40'
                            }`}
                          >
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={profile.avatar_url} alt={profile.full_name || ''} />
                              <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{profile.full_name || 'User'}</p>
                              <p className="truncate text-xs text-muted-foreground">{profile.role || 'umat'}</p>
                            </div>
                            <div
                              className={`h-4 w-4 rounded-sm border ${
                                selected ? 'border-primary bg-primary' : 'border-border'
                              }`}
                            />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full rounded-full" disabled={isCreatingGroup}>
                  {isCreatingGroup ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Membuat grup...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4" />
                      Buat Grup
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="join" className="mt-4 space-y-4">
              <form onSubmit={handleJoinGroup} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="invite-code" className="text-sm font-medium">
                    Kode Undangan
                  </label>
                  <Input
                    id="invite-code"
                    placeholder="Tempel kode atau link undangan"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    disabled={isJoiningGroup}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Kode biasanya dibagikan oleh admin grup.
                  </p>
                </div>

                <Button type="submit" className="w-full rounded-full" disabled={isJoiningGroup}>
                  {isJoiningGroup ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Gabung Grup
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
