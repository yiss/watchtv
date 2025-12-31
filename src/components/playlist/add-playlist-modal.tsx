import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { savePlaylist } from '@/lib/storage'
import { Playlist } from '@/types'

const m3uSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Invalid URL'),
})

const xtreamSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  serverUrl: z.string().url('Invalid Server URL'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

interface AddPlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editPlaylist?: Playlist | null
}

export function AddPlaylistModal({ isOpen, onClose, onSuccess, editPlaylist }: AddPlaylistModalProps) {
  const [activeTab, setActiveTab] = useState<'m3u' | 'xtream'>('m3u')

  const m3uForm = useForm<z.infer<typeof m3uSchema>>({
    resolver: zodResolver(m3uSchema),
    defaultValues: { name: '', url: '' },
  })

  const xtreamForm = useForm<z.infer<typeof xtreamSchema>>({
    resolver: zodResolver(xtreamSchema),
    defaultValues: { name: '', serverUrl: '', username: '', password: '' },
  })

  // Pre-fill form when editing
  useEffect(() => {
    if (editPlaylist) {
      setActiveTab(editPlaylist.type)
      if (editPlaylist.type === 'm3u') {
        m3uForm.reset({
          name: editPlaylist.name,
          url: editPlaylist.url || '',
        })
      } else {
        xtreamForm.reset({
          name: editPlaylist.name,
          serverUrl: editPlaylist.serverUrl || '',
          username: editPlaylist.username || '',
          password: editPlaylist.password || '',
        })
      }
    } else {
      m3uForm.reset({ name: '', url: '' })
      xtreamForm.reset({ name: '', serverUrl: '', username: '', password: '' })
    }
  }, [editPlaylist, isOpen])

  const onM3USubmit = (values: z.infer<typeof m3uSchema>) => {
    const playlist: Playlist = {
      id: editPlaylist?.id || crypto.randomUUID(),
      name: values.name,
      type: 'm3u',
      url: values.url,
      updatedAt: Date.now(),
    }
    savePlaylist(playlist)
    onSuccess()
    m3uForm.reset()
  }

  const onXtreamSubmit = (values: z.infer<typeof xtreamSchema>) => {
    const playlist: Playlist = {
      id: editPlaylist?.id || crypto.randomUUID(),
      name: values.name,
      type: 'xtream',
      serverUrl: values.serverUrl,
      username: values.username,
      password: values.password,
      updatedAt: Date.now(),
    }
    savePlaylist(playlist)
    onSuccess()
    xtreamForm.reset()
  }

  const isEditing = !!editPlaylist

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Playlist' : 'Add Playlist'}</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          {!isEditing && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="m3u">M3U Link</TabsTrigger>
              <TabsTrigger value="xtream">Xtream Codes</TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="m3u" className={isEditing && activeTab === 'm3u' ? 'mt-0' : ''}>
            <Form {...m3uForm}>
              <form onSubmit={m3uForm.handleSubmit(onM3USubmit)} className="space-y-4 py-4">
                <FormField
                  control={m3uForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Playlist Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Playlist" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={m3uForm.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>M3U URL</FormLabel>
                      <FormControl>
                        <Input placeholder="http://example.com/playlist.m3u" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  {isEditing ? 'Save Changes' : 'Save Playlist'}
                </Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="xtream" className={isEditing && activeTab === 'xtream' ? 'mt-0' : ''}>
            <Form {...xtreamForm}>
              <form onSubmit={xtreamForm.handleSubmit(onXtreamSubmit)} className="space-y-4 py-4">
                <FormField
                  control={xtreamForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Playlist Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Service" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={xtreamForm.control}
                  name="serverUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Server URL</FormLabel>
                      <FormControl>
                        <Input placeholder="http://example.com:8080" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={xtreamForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={xtreamForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  {isEditing ? 'Save Changes' : 'Save Playlist'}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
