export default function NotFound() {
  return (
    <div className="mx-auto text-center p-4 lg:p-12 border-4 border-dashed shadow-2xl rounded-xl max-w-lg w-full transform transition-all duration-300 hover:scale-[1.02]">
      <h1 className="text-6xl lg:text-9xl font-extrabold mb-6 drop-shadow-xl select-none">404</h1>

      <p className="text-xl lg:text-3xl font-bold mb-4">~ Miau... Página Não Encontrada 🐈‍⬛ ~</p>

      <p className="text-lg mb-8">
        Ops, o chef(e) não deixou petiscos aqui. Essa rota está vazia.
        <br />
        (Provavelmente eu a derrubei da mesa.)
      </p>
    </div>
  );
}
