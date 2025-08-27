
"use client"

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/icons/logo';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { initialUsers } from '@/lib/in-memory-db';

const staffUsers = initialUsers.filter(u => u.role === 'Staff');

export default function StaffLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Clear any existing session on load
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
  }, []);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const user = staffUsers.find(u => u.email === email && u.password === password);
      if (user) {
        toast({
          title: "Login Successful",
          description: "Redirecting to staff dashboard...",
        });
        localStorage.setItem('userRole', 'Staff');
        localStorage.setItem('userId', user.id); 
        router.push('/staff/dashboard');
      } else {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid credentials for a staff account.",
        });
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <Logo className="h-12 w-auto text-primary" />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Staff Login</CardTitle>
          <CardDescription>
            Enter your credentials to access the staff dashboard.
             <p className="text-xs text-muted-foreground mt-2">
                Test with: support@comfortpay.com, finance@comfortpay.com, etc. (pw: password)
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="staff@comfortpay.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
           <div className="mt-4 text-center text-sm">
            Not a staff member?{' '}
            <Link href="/" className="underline">
              Return to main page
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
