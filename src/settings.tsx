import { createRoot } from "react-dom/client";

const Setting = () => {
  return (
	<div>
      <div>
        <input
          type="checkbox"
        />
        Dark mode
      </div>
      <div>
        OPENA API KEY        
        <input
          type=""
        />
      </div>      
	</div>
  );
};

function render() {
  const root = createRoot(document.getElementById("root"));
  root.render(<Setting />);
}

render();
