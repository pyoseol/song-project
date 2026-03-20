// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Composer } from './pages/Composer';
import PostList from './pages/community/PostList';
import PostWrite from './pages/community/PostWrite';
import PostDetail from './pages/community/PostDetail';

function App() {
  return (
    <BrowserRouter>
      {/* 네비게이션 바가 있다면 여기에 위치 */}
      <Routes>
        <Route path="/" element={<Composer />} />
        
        {/* 커뮤니티 관련 라우트 */}
        <Route path="/community" element={<PostList />} />
        <Route path="/community/write" element={<PostWrite />} />
        <Route path="/community/:id" element={<PostDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;