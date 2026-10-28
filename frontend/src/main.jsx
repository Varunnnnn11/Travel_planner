import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import NewTrip from "./pages/NewTrip.jsx";
import TripPage from "./pages/TripPage.jsx";
import SharedTrip from "./pages/SharedTrip.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/share/:shareId" element={<SharedTrip />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewTrip />} />
          <Route path="/trips/:tripId" element={<TripPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
