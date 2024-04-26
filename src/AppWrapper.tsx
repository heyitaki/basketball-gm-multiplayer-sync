import { App } from './App';
import appStyles from './App.scss?inline';

function AppWrapper() {
  return (
    <>
      <App />
      <style type="text/css">{appStyles}</style>
    </>
  );
}

export default AppWrapper;
