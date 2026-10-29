import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { SearchIcon } from "./Icons";

export function SearchBox() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const query = location.pathname === "/entities" ? (searchParams.get("q") ?? "") : "";
  return (
    <label className="search">
      <SearchIcon />
      <span className="visually-hidden">Buscar entidade</span>
      <input
        type="search"
        placeholder="Buscar pessoa ou organização"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          const target = value === "" ? "/entities" : `/entities?q=${encodeURIComponent(value)}`;
          void navigate(target, { replace: location.pathname === "/entities" });
        }}
      />
    </label>
  );
}
