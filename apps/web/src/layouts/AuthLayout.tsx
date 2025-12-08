import { Outlet } from 'react-router-dom';
import { Leaf } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Левая панель с брендингом */}
      <div className="hidden lg:flex lg:w-1/2 gradient-earth relative overflow-hidden">
        {/* Декоративные элементы */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <Leaf className="w-7 h-7 text-primary-400" />
            </div>
            <span className="text-3xl font-bold text-white">Полевие</span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4 text-balance">
            Автоматизация полевых выездов
          </h1>

          <p className="text-lg text-primary-200/80 max-w-md">
            Управляйте приказами, генерируйте пробы, создавайте бирки и
            документы — всё в одном месте
          </p>

          <div className="mt-12 space-y-4">
            <Feature text="Автоматическая генерация шифров проб" />
            <Feature text="Распознавание координат с GPS-трекера" />
            <Feature text="Экспорт данных в Excel по шаблонам" />
            <Feature text="Работа из Telegram и с десктопа" />
          </div>
        </div>
      </div>

      {/* Правая панель с формой */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Логотип для мобильных */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-primary-400" />
            </div>
            <span className="text-2xl font-bold">Полевие</span>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full bg-primary-400" />
      <span className="text-primary-100">{text}</span>
    </div>
  );
}

