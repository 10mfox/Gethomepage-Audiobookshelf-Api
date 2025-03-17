import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  BookOpen, 
  Database,
  Settings, 
  Code,
  Layout,
  Home
} from 'lucide-react';

/**
 * Navigation bar component
 */
const Navbar = () => {
  const navItems = [
    {
      to: '/',
      label: 'Recent Media',
      icon: <BookOpen className="h-4 w-4" />
    },
    {
      to: '/libraries',
      label: 'Libraries',
      icon: <Database className="h-4 w-4" />
    },
    {
      to: '/formats',
      label: 'Format Settings',
      icon: <Layout className="h-4 w-4" />
    },
    {
      to: '/homepage',
      label: 'Homepage Config',
      icon: <Home className="h-4 w-4" />
    },
    {
      to: '/setup',
      label: 'Setup',
      icon: <Settings className="h-4 w-4" />
    },
    {
      to: '/api',
      label: 'API Endpoints',
      icon: <Code className="h-4 w-4" />
    }
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0 flex items-center">
            <span className="text-xl font-bold text-white">Audiobookshelf Manager Test</span>
          </div>
          
          <div className="hidden md:block">
            <div className="flex items-center space-x-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => 
                    `px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
                      isActive 
                        ? 'bg-blue-700 text-white' 
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div className="md:hidden border-t border-gray-800">
        <div className="grid grid-cols-6 gap-1 p-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 
                `flex flex-col items-center justify-center p-2 rounded-md text-xs ${
                  isActive 
                    ? 'bg-blue-700 text-white' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              {item.icon}
              <span className="mt-1">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;