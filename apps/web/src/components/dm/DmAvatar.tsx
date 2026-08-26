import clsx from "clsx";

interface DmAvatarProps {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  online: boolean;
}

/**
 * The little square portrait Slack shows beside a DM, with the presence dot
 * tucked into its corner. Without a picture it falls back to an initial on a
 * tinted square rather than a bare dot, so the row keeps its shape either way.
 */
export function DmAvatar({ userId, displayName, avatarUrl, online }: DmAvatarProps) {
  return (
    <span className="relative w-5 h-5 shrink-0" data-testid={`dm-avatar-${userId}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="w-5 h-5 rounded object-cover block"
        />
      ) : (
        <span className="w-5 h-5 rounded bg-white/20 flex items-center justify-center text-[10px] font-semibold text-white uppercase">
          {displayName.trim().charAt(0) || "?"}
        </span>
      )}
      <span
        data-testid={`presence-${userId}`}
        aria-label={online ? "Online" : "Away"}
        className={clsx(
          // Sits on the corner with a ring in the sidebar colour so it reads
          // as separate from the picture behind it.
          "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar",
          online ? "bg-green-500" : "bg-gray-500",
        )}
      />
    </span>
  );
}
