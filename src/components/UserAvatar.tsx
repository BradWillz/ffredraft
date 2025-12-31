"use client";

interface UserAvatarProps {
  username: string;
}

export default function UserAvatar({ username }: UserAvatarProps) {
  // Remove @ symbol for filename lookup
  const cleanUsername = username.replace('@', '');
  
  return (
    <img 
      src={`/avatars/${cleanUsername}.jpg`}
      alt={username}
      className="w-20 h-20 rounded-full object-cover border-2 border-blue-500"
      onError={(e) => {
        // Fallback to default avatar if image not found
        e.currentTarget.src = '/avatars/default.jpg';
      }}
    />
  );
}
