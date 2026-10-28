import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
  /** Liga `DialogTitle` a `aria-labelledby` no `DialogContent`, para leitor de tela anunciar o título ao abrir. */
  titleId: string
}

const DialogContext = React.createContext<DialogContextType | undefined>(undefined)

function useDialogContext() {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog")
  }
  return context
}

const Dialog = ({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const titleId = React.useId()
  return (
    <DialogContext.Provider value={{ open, setOpen: onOpenChange, titleId }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, ...props }, ref) => {
  const { setOpen } = useDialogContext()
  return (
    <button
      ref={ref}
      onClick={(e) => {
        setOpen(true)
        onClick?.(e)
      }}
      {...props}
    />
  )
})
DialogTrigger.displayName = "DialogTrigger"

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

type DialogContentProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Janela flutuante: sem fundo escurecido, a página atrás continua
   * visível e utilizável, e a caixa pode ser arrastada pelo elemento com
   * `data-arrastar` (normalmente o título) — para quem precisa consultar a
   * tela enquanto escreve (ex.: feedback). Não prende o foco.
   */
  flutuante?: boolean
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, flutuante = false, ...props }, forwardedRef) => {
  const { open, setOpen, titleId } = useDialogContext()
  const internalRef = React.useRef<HTMLDivElement>(null)
  React.useImperativeHandle(forwardedRef, () => internalRef.current as HTMLDivElement)
  const [posicao, setPosicao] = React.useState<{ x: number; y: number } | null>(null)

  function iniciarArraste(evento: React.PointerEvent<HTMLDivElement>) {
    if (!flutuante) return
    const alvo = evento.target as HTMLElement
    if (!alvo.closest("[data-arrastar]") || alvo.closest("button, input, textarea, select, a")) return
    const caixa = internalRef.current
    if (!caixa) return
    const ret = caixa.getBoundingClientRect()
    const dx = evento.clientX - ret.left
    const dy = evento.clientY - ret.top
    evento.preventDefault()
    function mover(e: PointerEvent) {
      const x = Math.min(Math.max(0, e.clientX - dx), window.innerWidth - 80)
      const y = Math.min(Math.max(0, e.clientY - dy), window.innerHeight - 48)
      setPosicao({ x, y })
    }
    function soltar() {
      window.removeEventListener("pointermove", mover)
      window.removeEventListener("pointerup", soltar)
    }
    window.addEventListener("pointermove", mover)
    window.addEventListener("pointerup", soltar)
  }

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [open, setOpen])

  // Move o foco para dentro do modal ao abrir (leitor de tela anuncia o
  // diálogo em vez de ficar "preso" no elemento que disparou a abertura),
  // e faz um focus trap simples (Tab/Shift+Tab não escapam para trás do
  // overlay) enquanto estiver aberto.
  React.useEffect(() => {
    if (!open || flutuante) return
    const container = internalRef.current
    if (!container) return
    const primeiroFocavel = container.querySelector<HTMLElement>(SELETOR_FOCAVEL)
    ;(primeiroFocavel ?? container).focus()

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Tab" || !container) return
      const focaveis = Array.from(container.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL))
      if (focaveis.length === 0) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener("keydown", aoTeclar)
    return () => document.removeEventListener("keydown", aoTeclar)
  }, [open, flutuante])

  if (!open) return null

  // Portal para document.body: um `Dialog` aberto de dentro do header (ex.:
  // BotaoFeedback) fica preso ali sem isto, porque o header tem
  // `backdrop-filter` (backdrop-blur/backdrop-saturate) — e um ancestral
  // com filter/backdrop-filter cria um novo containing block para
  // `position: fixed`, então o modal passa a se posicionar relativo ao
  // header (uns 60px de altura) em vez da viewport inteira, aparecendo
  // preso perto do topo. Mesmo problema (e mesma solução) já visto neste
  // projeto no menu do `SeletorSecretarias`.
  if (typeof document === "undefined") return null

  return createPortal(
    <>
      {!flutuante && (
        <div
          className="fixed inset-0 z-40 bg-black/80"
          onClick={() => setOpen(false)}
        />
      )}
      <div
        ref={internalRef}
        role="dialog"
        aria-modal={flutuante ? undefined : "true"}
        aria-labelledby={titleId}
        tabIndex={-1}
        onPointerDown={iniciarArraste}
        style={
          flutuante
            ? posicao
              ? { left: posicao.x, top: posicao.y }
              : { right: 24, top: 80 }
            : undefined
        }
        className={cn(
          "fixed z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-lg outline-none",
          flutuante
            ? "sm:shadow-2xl"
            : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          className
        )}
        {...props}
      >
        {children}
        <button
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </>,
    document.body
  )
})
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, id, ...props }, ref) => {
  const { titleId } = useDialogContext()
  return (
    <h2
      ref={ref}
      id={id ?? titleId}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
})
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-slate-500", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
}
