"use client";

interface UserAvatarProps {
  username: string;
  size?: "sm" | "md" | "lg";
}

export default function UserAvatar({ username, size = "lg" }: UserAvatarProps) {
  // Remove @ symbol for filename lookup
  const cleanUsername = username.replace('@', '');
  
  const sizeClasses = {
    sm: "w-8 h-8 sm:w-10 sm:h-10 border-2",
    md: "w-12 h-12 sm:w-14 sm:h-14 border-2",
    lg: "w-20 h-20 border-2"
  };
  
  return (
    <img 
      src={`/avatars/${cleanUsername}.jpg`}
      alt={username}
      className={`${sizeClasses[size]} rounded-full object-cover border-blue-500`}
      onError={(e) => {
        // Fallback to default avatar if image not found
        e.currentTarget.src = '/avatars/default.jpg';
      }}
    />
  );
}
