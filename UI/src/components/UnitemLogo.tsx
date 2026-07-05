interface UnitemLogoProps {
  placement?: 'default' | 'rail'
  className?: string
}

export default function UnitemLogo({
  placement = 'default',
  className,
}: UnitemLogoProps) {
  const rail = placement === 'rail'

  return (
    <img
      src="/unitem-logo-transparent.png"
      alt="Unitem"
      draggable={false}
      className={[
        'unitem-logo select-none object-contain',
        rail ? 'unitem-logo--rail h-[4.5rem] w-full max-w-[13rem]' : 'h-8 w-auto',
        className ?? '',
      ].join(' ')}
    />
  )
}
